"use client";

// create event form -- lets the admin create a new on-chain event
// flow: fill form -> upload image to ipfs -> call createEvent() on the contract

import { useState, useRef } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import toast from "react-hot-toast";
import { PIZZA_POAP_ABI, PIZZA_POAP_ADDRESS } from "@/lib/contract";
import { uploadToIPFS, ipfsToHttp } from "@/lib/pinata";

type FormState = "idle" | "uploading" | "pending" | "success" | "error";

export function CreateEventForm({ onEventCreated }: { onEventCreated?: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageURI, setImageURI] = useState<string | null>(null); // ipfs:// uri after upload
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [successEventId, setSuccessEventId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { writeContract, data: txHash } = useWriteContract();

  // watch for the transaction to confirm on-chain
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // handle image file selection -- show preview immediately
  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImageURI(null); // clear any previously uploaded uri
    // create a local preview url so the admin can see the image right away
    const preview = URL.createObjectURL(file);
    setImagePreview(preview);
  }

  // clear the selected image
  function handleClearImage() {
    setImageFile(null);
    setImagePreview(null);
    setImageURI(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // full submit flow: upload image -> create event on-chain
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    // basic validation
    if (!name.trim()) return setError("event name is required");
    if (!description.trim()) return setError("description is required");
    if (!eventDate) return setError("event date is required");
    if (!imageFile && !imageURI) return setError("event artwork is required");

    try {
      let finalImageURI = imageURI;

      // step 1: upload image to ipfs if not already done
      if (imageFile && !imageURI) {
        setFormState("uploading");
        const uploadToast = toast.loading("Uploading artwork to IPFS...");
        const result = await uploadToIPFS(imageFile);
        toast.dismiss(uploadToast);
        if (!result.ok) {
          toast.error(`IPFS upload failed: ${result.error}`);
          return setError(result.error);
        }
        toast.success("Artwork pinned to IPFS ✓");
        finalImageURI = result.uri;
        setImageURI(result.uri);
      }

      // step 2: send the createEvent transaction
      setFormState("pending");
      const unixDate = Math.floor(new Date(eventDate).getTime() / 1000);

      writeContract(
        {
          abi: PIZZA_POAP_ABI,
          address: PIZZA_POAP_ADDRESS,
          functionName: "createEvent",
          args: [name.trim(), description.trim(), finalImageURI!, BigInt(unixDate)],
        },
        {
          onSuccess: () => {
            toast.loading("Transaction submitted — waiting for confirmation...", {
              id: "tx-pending",
            });
          },
          onError: (err) => {
            toast.error("Transaction rejected");
            setError(err.message);
          },
        }
      );
    } catch (err: any) {
      setError(err.message || "something went wrong");
    }
  }

  // react to tx confirmation
  if (txConfirmed && formState === "pending" && successEventId === null) {
    toast.dismiss("tx-pending");
    toast.success("Event created on-chain! 🍕");
    setFormState("success");
    setSuccessEventId("created");
    onEventCreated?.(); // tell the parent to refresh the events list
  }

  function setError(msg: string) {
    setErrorMsg(msg);
    setFormState("error");
  }

  function reset() {
    setName("");
    setDescription("");
    setEventDate("");
    setImageFile(null);
    setImagePreview(null);
    setImageURI(null);
    setFormState("idle");
    setErrorMsg("");
    setSuccessEventId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // success screen
  if (formState === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <span className="text-5xl">🍕</span>
        <h3 className="text-lg font-semibold text-white">Event created!</h3>
        <p className="text-sm text-zinc-400">
          The event is live on Monad. Run{" "}
          <code className="rounded bg-zinc-800 px-1 py-0.5 text-orange-400">
            npm run dispense
          </code>{" "}
          after the call to send tokens to attendees.
        </p>
        <button
          onClick={reset}
          className="mt-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-500"
        >
          Create another event
        </button>
      </div>
    );
  }

  const isBusy = formState === "uploading" || formState === "pending";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* event name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-300">Event name</label>
        <input
          type="text"
          placeholder="Pizza DAO Call - Mar 1 2026"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isBusy}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-orange-500 focus:outline-none disabled:opacity-50"
        />
      </div>

      {/* description */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-300">Description</label>
        <textarea
          placeholder="Weekly Pizza DAO community call attendance token"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isBusy}
          rows={2}
          className="resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-orange-500 focus:outline-none disabled:opacity-50"
        />
      </div>

      {/* event date */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-300">Event date</label>
        <input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          disabled={isBusy}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none disabled:opacity-50 [color-scheme:dark]"
        />
      </div>

      {/* artwork upload */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-zinc-300">
          Event artwork
          {imageURI && (
            <span className="ml-2 text-xs font-normal text-green-400">
              ✓ uploaded to IPFS
            </span>
          )}
        </label>

        {/* image preview or upload area */}
        {imagePreview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview}
              alt="event artwork preview"
              className="h-40 w-full rounded-lg object-cover"
            />
            {!isBusy && (
              <button
                type="button"
                onClick={handleClearImage}
                className="absolute right-2 top-2 rounded-full bg-zinc-900/80 px-2 py-0.5 text-xs text-zinc-300 hover:text-white"
              >
                ✕ remove
              </button>
            )}
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-700 py-8 text-center transition hover:border-orange-600">
            <span className="text-2xl">🖼️</span>
            <span className="text-sm text-zinc-400">
              Click to upload image (PNG, JPG, GIF)
            </span>
            <span className="text-xs text-zinc-600">
              Will be pinned to IPFS via Pinata
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              disabled={isBusy}
              className="hidden"
            />
          </label>
        )}
      </div>

      {/* error message */}
      {formState === "error" && (
        <p className="rounded-lg border border-red-900 bg-red-950/30 px-3 py-2.5 text-sm text-red-400">
          {errorMsg}
        </p>
      )}

      {/* submit button -- label changes based on state */}
      <button
        type="submit"
        disabled={isBusy}
        className="flex items-center justify-center gap-2 rounded-lg bg-orange-600 py-3 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {formState === "uploading" && (
          <>
            <Spinner /> Uploading to IPFS...
          </>
        )}
        {formState === "pending" && (
          <>
            <Spinner /> Waiting for transaction...
          </>
        )}
        {(formState === "idle" || formState === "error") && "🍕 Create Event"}
      </button>
    </form>
  );
}

// tiny spinner used in the button
function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
