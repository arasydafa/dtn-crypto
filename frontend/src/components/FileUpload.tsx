/**
 * @module components/FileUpload
 * @description Custom .txt payload upload — OmegaOS phase 4.
 *
 * Wraps @omega-os/ui FileUpload (drag-drop, type/size validation) and reads
 * the accepted file as text for the simulation payload. Clearing resets both
 * the OmegaOS item list and the DTN payload.
 */

import { useState } from "react";
import { FileUpload as OmegaFileUpload, Button } from "@omega-os/ui";
import { X } from "lucide-react";

/** Props for the FileUpload component. */
interface Props {
  /** Callback when file content is read. Pass empty string to clear. */
  onFileContent: (content: string) => void;

  /** Current payload text (for showing the clear button). */
  currentPayload: string | null | undefined;
}

/** Maximum file size in bytes (1MB). */
const MAX_SIZE = 1_048_576;

export default function FileUpload({ onFileContent, currentPayload }: Props) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const handleFiles = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFileName(file.name);
      onFileContent(reader.result as string);
    };
    reader.readAsText(file);
  };

  /** Clear the uploaded file and reset the payload. */
  const handleClear = () => {
    setFileName(null);
    setResetKey((k) => k + 1);
    onFileContent("");
  };

  return (
    <div className="flex flex-col gap-1.5">
      <OmegaFileUpload
        key={resetKey}
        accept=".txt"
        multiple={false}
        maxSize={MAX_SIZE}
        maxFiles={1}
        label="Payload file"
        helper=".txt up to 1 MB"
        onFiles={handleFiles}
      />
      {fileName && currentPayload && (
        <div className="flex items-center justify-between text-[11px] text-ot-muted">
          <span className="truncate font-medium text-navy-text">{fileName}</span>
          <Button variant="ghost" size="sm" onClick={handleClear} icon={<X size={12} aria-hidden />}>
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
