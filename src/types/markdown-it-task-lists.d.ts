// markdown-it-task-lists ships without type definitions.
declare module 'markdown-it-task-lists' {
  import type { PluginWithOptions } from 'markdown-it';

  interface TaskListsOptions {
    /** Render checkboxes as enabled (clickable) inputs. Default false. */
    enabled?: boolean;
    /** Wrap the item text in a <label>. Default false. */
    label?: boolean;
    /** Put the <label> after the checkbox. Default false. */
    labelAfter?: boolean;
  }

  const taskLists: PluginWithOptions<TaskListsOptions>;
  export default taskLists;
}
