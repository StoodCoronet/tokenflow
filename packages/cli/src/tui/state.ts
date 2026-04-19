export let pendingEditor: string | null = null

export function setPendingEditor(editor: string) {
  pendingEditor = editor
}

export function clearPendingEditor() {
  pendingEditor = null
}
