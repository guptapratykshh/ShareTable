import { useRef, useState } from "react";
import { uploadPhoto } from "../utils/photo";
import { Button } from "./Form";

export function PhotoPicker({
  role,
  value,
  onChange,
  onError,
}: {
  role: "DONOR" | "RECIPIENT";
  value?: string;
  onChange: (url: string | undefined) => void;
  onError: (message: string) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>();
  const [pending, setPending] = useState(false);
  const isCollector = role === "RECIPIENT";

  async function onFile(file?: File) {
    if (!file) return;
    onError("");
    setPending(true);
    const local = URL.createObjectURL(file);
    setPreview(local);
    try {
      const url = await uploadPhoto(file);
      onChange(url);
    } catch (err) {
      setPreview(undefined);
      onChange(undefined);
      onError(err instanceof Error ? err.message : "Could not upload photo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-foreground">
        {isCollector ? "Your photo" : "Photo of your organization or pickup spot"}
      </span>
      <p className="text-xs text-muted">
        {isCollector
          ? "Optional. Take a selfie or pick a photo so the donor knows who is at the door."
          : "Optional. A photo of the mess entrance, kitchen door, or facade helps collectors find you."}
      </p>
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {isCollector && (
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {isCollector && (
          <Button type="button" variant="outline" disabled={pending} onClick={() => cameraRef.current?.click()}>
            Take photo
          </Button>
        )}
        <Button type="button" variant="outline" disabled={pending} onClick={() => galleryRef.current?.click()}>
          {isCollector ? "Choose from gallery" : "Choose photo"}
        </Button>
      </div>
      {(preview || value) && (
        <img
          src={preview || value}
          alt={isCollector ? "Your photo preview" : "Pickup spot preview"}
          className="mt-2 h-36 w-full rounded-xl object-cover"
        />
      )}
      {pending && <p className="text-xs text-muted">Uploading photo…</p>}
    </div>
  );
}
