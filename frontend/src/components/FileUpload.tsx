/**
 * @module components/FileUpload
 * @description File upload widget for custom .txt payloads.
 *
 * Provides a hidden file input triggered by a styled button. Validates
 * that the file is `.txt` and under 1MB. Reads the file as text and
 * passes the content to the parent via callback.
 *
 * @example
 * ```tsx
 * <FileUpload
 *   onFileContent={(text) => setConfig({ payload_text: text })}
 *   currentPayload={config.payload_text}
 * />
 * ```
 */

import { useRef, useState } from "react";

/** Props for the FileUpload component. */
interface Props {
  /** Callback when file content is read. Pass empty string to clear. */
  onFileContent: (content: string) => void;

  /** Current payload text (for showing the clear button). */
  currentPayload: string | null | undefined;
}

/** Maximum file size in bytes (1MB). */
const MAX_SIZE = 1_048_576;

/**
 * File upload widget for `.txt` payloads.
 *
 * Features:
 * - Hidden `<input type="file">` triggered by a button click
 * - File validation: `.txt` extension only, 1MB max size
 * - Reads file as text via `FileReader.readAsText()`
 * - Shows file name and clear button after upload
 * - Resets input so re-selecting the same file triggers change
 */
export default function FileUpload({ onFileContent, currentPayload }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  /**
   * Handle file selection. Validates size, reads as text, and calls callback.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE) {
      alert("File too large. Maximum size is 1 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setFileName(file.name);
      onFileContent(text);
    };
    reader.readAsText(file);

    // Reset so re-selecting same file triggers change
    e.target.value = "";
  };

  /** Clear the uploaded file and reset the payload. */
  const handleClear = () => {
    setFileName(null);
    onFileContent("");
  };

  return (
    <div className="file-upload">
      <input
        ref={inputRef}
        type="file"
        accept=".txt"
        onChange={handleChange}
        style={{ display: "none" }}
      />
      <button
        type="button"
        className="file-upload-btn"
        onClick={() => inputRef.current?.click()}
      >
        Upload .txt file
      </button>
      {fileName && currentPayload && (
        <div className="file-upload-info">
          <span className="file-name">{fileName}</span>
          <button type="button" className="file-clear" onClick={handleClear}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
