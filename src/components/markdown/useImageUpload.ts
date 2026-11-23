// Stores pasted / dropped / picked images in the assets folder and inserts relative Markdown links to them.
import { useCallback, useRef } from 'react';
import type { EditorView } from '@codemirror/view';
import { useStorage } from '../../storage';
import { useMessages } from '../../i18n';
import { useToast, type ToastApi } from '../../ui';
import { altTextFor, assetBaseName, checkImage, uniqueAssetName } from './assets';
import { hideUpload, showUpload, uploadPosition } from './editor/uploadPlaceholders';
import { imageMarkdown } from './format';
import { markdownMessages } from './messages';
import { dirname, encodePath, relativePath } from './paths';

/** Names handed out but maybe not written yet, so two quick uploads of "image.png" do not collide. */
const reserved = new Set<string>();
let uploadCount = 0;

/** `useToast()` that also works outside a `<ToastProvider>` (the context read happens before the throw). */
function useOptionalToast(): ToastApi | null {
  try {
    return useToast();
  } catch {
    return null;
  }
}

/**
 * Returns `upload(view, files, pos)`. Errors are shown as toasts (or passed to `onError` when there is no
 * ToastProvider).
 */
export function useImageUpload(docPath: string, assetsDir: string, onError: (message: string) => void) {
  const storage = useStorage();
  const t = useMessages(markdownMessages);
  const toast = useOptionalToast();
  const report = useRef<(message: string) => void>(onError);
  report.current = (message) => (toast ? toast.show(message, 'error') : onError(message));

  return useCallback(
    async (view: EditorView, files: File[], pos: number) => {
      let taken: string[] | null = null;
      for (const file of files) {
        const check = checkImage(file);
        if (!check.ok) {
          report.current(check.reason === 'size' ? t.imageTooBig(file.name) : t.imageBadType(file.name));
          continue;
        }
        const id = `upload-${++uploadCount}`;
        showUpload(view, id, pos, t.uploading(file.name));
        try {
          taken ??= (await storage.list(assetsDir)).map((p) => p.slice(p.lastIndexOf('/') + 1));
          const name = uniqueAssetName(assetBaseName(file.name), check.ext, [...taken, ...reserved]);
          reserved.add(name);
          taken.push(name);
          const assetPath = `${assetsDir}/${name}`;
          await storage.writeBytes(assetPath, new Uint8Array(await file.arrayBuffer()));
          const src = encodePath(relativePath(dirname(docPath), assetPath));
          if (!view.dom.isConnected) continue; // the editor went away while writing; the file is stored anyway
          const at = uploadPosition(view.state, id) ?? view.state.selection.main.head;
          const text = imageMarkdown(altTextFor(file.name), src);
          // Give the image its own paragraph, so it does not become part of the list item or text above it.
          const line = view.state.doc.lineAt(at);
          const above = line.number > 1 ? view.state.doc.line(line.number - 1).text : '';
          const before = at > line.from ? '\n\n' : above.trim() ? '\n' : '';
          const insert = `${before}${text}\n`;
          view.dispatch({
            changes: { from: at, insert },
            selection: { anchor: at + insert.length },
            userEvent: 'input.paste',
          });
          pos = at + insert.length;
        } catch (err) {
          report.current(t.imageFailed(file.name, err instanceof Error ? err.message : String(err)));
        } finally {
          if (view.dom.isConnected) hideUpload(view, id);
        }
      }
    },
    [storage, docPath, assetsDir, t],
  );
}
