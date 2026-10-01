// File System Access API (Chrome/Edge de escritorio): partes que todavía no trae lib.dom de TypeScript

interface FileSystemDirectoryHandle {
  keys(): AsyncIterableIterator<string>
  queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
  requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
}

interface Window {
  showDirectoryPicker?(opciones?: { id?: string; mode?: 'read' | 'readwrite'; startIn?: 'desktop' | 'documents' | 'downloads' }): Promise<FileSystemDirectoryHandle>
}
