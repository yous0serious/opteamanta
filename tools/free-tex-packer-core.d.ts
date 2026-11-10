// Typen für free-tex-packer-core (das Paket liefert keine mit).
declare module 'free-tex-packer-core' {
  interface PackImage {
    path: string;
    contents: Buffer;
  }
  interface PackOptions {
    textureName: string;
    width?: number;
    height?: number;
    fixedSize?: boolean;
    powerOfTwo?: boolean;
    padding?: number;
    extrude?: number;
    allowRotation?: boolean;
    allowTrim?: boolean;
    detectIdentical?: boolean;
    removeFileExtension?: boolean;
    prependFolderName?: boolean;
    exporter?: string;
    packer?: string;
    packerMethod?: string;
  }
  interface PackFile {
    name: string;
    buffer: Buffer;
  }
  function pack(images: PackImage[], options: PackOptions, cb: (files: PackFile[], error?: Error) => void): void;
  export default pack;
}
