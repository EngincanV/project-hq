// "Uploading…" chips shown in the editor while an image is written. They are decorations, not text, so an
// autosave in the meantime never stores a placeholder; their position follows edits made around them.
import { StateEffect, StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';

const addUpload = StateEffect.define<{ id: string; pos: number; label: string }>();
const removeUpload = StateEffect.define<string>();

class UploadWidget extends WidgetType {
  constructor(private readonly label: string) {
    super();
  }

  eq(other: UploadWidget) {
    return other.label === this.label;
  }

  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-hq-uploading';
    span.setAttribute('role', 'status');
    span.textContent = this.label;
    return span;
  }
}

export const uploadPlaceholders = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(set, tr) {
    let next = set.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(addUpload)) {
        const { id, pos, label } = effect.value;
        const widget = Decoration.widget({ widget: new UploadWidget(label), side: 1, uploadId: id });
        next = next.update({ add: [widget.range(Math.min(pos, tr.state.doc.length))] });
      } else if (effect.is(removeUpload)) {
        next = next.update({ filter: (_from, _to, value) => value.spec.uploadId !== effect.value });
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function showUpload(view: EditorView, id: string, pos: number, label: string): void {
  view.dispatch({ effects: addUpload.of({ id, pos, label }) });
}

export function hideUpload(view: EditorView, id: string): void {
  view.dispatch({ effects: removeUpload.of(id) });
}

/** Current position of a placeholder, or null when it is gone. */
export function uploadPosition(state: EditorState, id: string): number | null {
  let found: number | null = null;
  state.field(uploadPlaceholders, false)?.between(0, state.doc.length, (from, _to, value) => {
    if (value.spec.uploadId === id) {
      found = from;
      return false;
    }
  });
  return found;
}
