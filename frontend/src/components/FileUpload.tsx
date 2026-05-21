import { useRef, useState } from "react";

interface Props {
  onFileContent: (content: string) => void;
  currentPayload: string | null | undefined;
}

const MAX_SIZE = 1_048_576; // 1MB

export default function FileUpload({ onFileContent, currentPayload }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

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
