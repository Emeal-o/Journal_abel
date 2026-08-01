import { useState, useRef } from "react";
import { X, Plus, Loader2, Pencil, Check, Ban } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useSetupTypes,
  useCreateSetupType,
  useDeleteSetupType,
  usePatchSetupType,
  type SetupType,
} from "@/lib/setup-types-api";

const MAX_ACTIVE = 10;
const MAX_NAME_LENGTH = 30;
const MAX_DESC_LENGTH = 120;
const EDIT_WINDOW_DAYS = 56; // 8 weeks

function daysOld(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
}

function isNameLocked(createdAt: string): boolean {
  return daysOld(createdAt) > EDIT_WINDOW_DAYS;
}

// ─── Inline edit row ──────────────────────────────────────────────────────────

interface EditRowProps {
  st: SetupType;
  onDone: () => void;
}

function EditRow({ st, onDone }: EditRowProps) {
  const { toast } = useToast();
  const patchSetupType = usePatchSetupType();
  const locked = isNameLocked(st.createdAt);
  const age = daysOld(st.createdAt);

  const [name, setName] = useState(st.name);
  const [desc, setDesc] = useState(st.description ?? "");

  const nameChanged = name.trim() !== st.name;
  const descChanged = (desc.trim() || null) !== (st.description ?? null);
  const hasChange = nameChanged || descChanged;

  const canSave =
    hasChange &&
    name.trim().length > 0 &&
    name.length <= MAX_NAME_LENGTH &&
    desc.length <= MAX_DESC_LENGTH &&
    !(nameChanged && locked);

  const handleSave = () => {
    const fields: { name?: string; description?: string | null } = {};
    if (nameChanged) fields.name = name.trim();
    if (descChanged) fields.description = desc.trim() || null;

    patchSetupType.mutate(
      { id: st.id, fields },
      {
        onSuccess: () => {
          toast({ title: `"${name.trim()}" updated` });
          onDone();
        },
        onError: (err) => {
          toast({
            title: err instanceof Error ? err.message : "Failed to update",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 space-y-2">
      {/* Color swatch + name */}
      <div className="flex items-center gap-2">
        <span
          className="flex-shrink-0 w-3 h-3 rounded-full ring-1 ring-white/20"
          style={{ backgroundColor: st.color }}
        />
        <div className="relative flex-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave && !patchSetupType.isPending) handleSave();
              if (e.key === "Escape") onDone();
            }}
            className="bg-white/5 border-white/10 pr-12 text-sm h-8"
            maxLength={MAX_NAME_LENGTH}
            disabled={locked || patchSetupType.isPending}
            autoFocus={!locked}
          />
          <span
            className={`absolute right-3 top-1/2 -translate-y-1/2 text-[11px] tabular-nums pointer-events-none transition-colors ${
              name.length >= MAX_NAME_LENGTH ? "text-amber-400" : "text-muted-foreground/40"
            }`}
          >
            {name.length}/{MAX_NAME_LENGTH}
          </span>
        </div>
      </div>

      {/* Name-locked hint */}
      {locked && (
        <p className="text-[11px] text-amber-400/70 flex items-center gap-1.5 pl-5">
          <Ban className="w-3 h-3 flex-shrink-0" />
          Name locked (created {age} days ago — older than 8 weeks).
          Description can still be edited.
        </p>
      )}

      {/* Description */}
      <div className="relative pl-5">
        <Textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value.slice(0, MAX_DESC_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === "Escape") onDone();
          }}
          placeholder="Optional description…"
          className="bg-white/5 border-white/10 text-sm resize-none pb-6 min-h-[56px]"
          maxLength={MAX_DESC_LENGTH}
          disabled={patchSetupType.isPending}
          rows={2}
          autoFocus={locked}
        />
        <span
          className={`absolute right-3 bottom-2 text-[11px] tabular-nums pointer-events-none transition-colors ${
            desc.length >= MAX_DESC_LENGTH ? "text-amber-400" : "text-muted-foreground/40"
          }`}
        >
          {desc.length}/{MAX_DESC_LENGTH}
        </span>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pl-5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-white"
          onClick={onDone}
          disabled={patchSetupType.isPending}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={handleSave}
          disabled={!canSave || patchSetupType.isPending}
        >
          {patchSetupType.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Check className="w-3 h-3" />
          )}
          Save
        </Button>
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface ManageSetupTypesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageSetupTypesModal({ open, onOpenChange }: ManageSetupTypesModalProps) {
  const { toast } = useToast();
  const { data: setupTypes = [], isLoading } = useSetupTypes();
  const createSetupType = useCreateSetupType();
  const deleteSetupType = useDeleteSetupType();

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const atCap = setupTypes.length >= MAX_ACTIVE;
  const canAdd =
    !atCap &&
    newName.trim().length > 0 &&
    newName.length <= MAX_NAME_LENGTH &&
    newDesc.length <= MAX_DESC_LENGTH;

  const handleAdd = () => {
    const trimmedName = newName.trim();
    const trimmedDesc = newDesc.trim();
    if (!trimmedName || atCap) return;
    createSetupType.mutate(
      { name: trimmedName, description: trimmedDesc || undefined },
      {
        onSuccess: () => {
          setNewName("");
          setNewDesc("");
          inputRef.current?.focus();
          toast({ title: `"${trimmedName}" added` });
        },
        onError: (err) => {
          toast({
            title: err instanceof Error ? err.message : "Failed to add setup type",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleDelete = (id: number, name: string) => {
    if (editingId === id) setEditingId(null);
    deleteSetupType.mutate(id, {
      onSuccess: () => toast({ title: `"${name}" removed` }),
      onError: (err) => {
        toast({
          title: err instanceof Error ? err.message : "Failed to remove setup type",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] bg-background border-white/10 shadow-2xl flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/10">
          <DialogTitle>Manage Setup Types</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Tag trades with a setup type to track your edge by strategy.
            {" "}Up to {MAX_ACTIVE} active types.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable list */}
        <div className="overflow-y-auto max-h-[360px] px-6 py-3 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          ) : setupTypes.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">
              No setup types yet. Add one below.
            </p>
          ) : (
            setupTypes.map((st) =>
              editingId === st.id ? (
                <EditRow key={st.id} st={st} onDone={() => setEditingId(null)} />
              ) : (
                <div
                  key={st.id}
                  className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[0.04] group transition-colors"
                >
                  {/* Color swatch */}
                  <span
                    className="flex-shrink-0 w-3 h-3 rounded-full ring-1 ring-white/20 mt-[3px]"
                    style={{ backgroundColor: st.color }}
                  />
                  {/* Name + description */}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-white truncate">{st.name}</span>
                    {st.description && (
                      <span className="block text-[11px] text-muted-foreground/60 leading-snug mt-0.5 line-clamp-2">
                        {st.description}
                      </span>
                    )}
                  </span>
                  {/* Edit + Delete buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all mt-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 text-muted-foreground/40 hover:text-white hover:bg-white/10"
                      onClick={() => setEditingId(st.id)}
                      disabled={deleteSetupType.isPending}
                      aria-label={`Edit ${st.name}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(st.id, st.name)}
                      disabled={deleteSetupType.isPending}
                      aria-label={`Remove ${st.name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ),
            )
          )}
        </div>

        {/* Add new form */}
        <div className="px-6 py-4 border-t border-white/10 space-y-3">
          {atCap ? (
            <p className="text-xs text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2.5 leading-relaxed">
              You've reached the {MAX_ACTIVE}-type limit. Remove one to add a new setup type.
            </p>
          ) : (
            <div className="space-y-2">
              {/* Name row */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    ref={inputRef}
                    placeholder="e.g. Breakout, VWAP Reclaim…"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value.slice(0, MAX_NAME_LENGTH))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canAdd && !createSetupType.isPending) {
                        handleAdd();
                      }
                    }}
                    className="bg-white/5 border-white/10 pr-12 text-sm"
                    maxLength={MAX_NAME_LENGTH}
                    disabled={createSetupType.isPending}
                  />
                  <span
                    className={`absolute right-3 top-1/2 -translate-y-1/2 text-[11px] tabular-nums pointer-events-none transition-colors ${
                      newName.length >= MAX_NAME_LENGTH
                        ? "text-amber-400"
                        : "text-muted-foreground/40"
                    }`}
                  >
                    {newName.length}/{MAX_NAME_LENGTH}
                  </span>
                </div>
                <Button
                  size="default"
                  onClick={handleAdd}
                  disabled={!canAdd || createSetupType.isPending}
                  className="gap-1.5 flex-shrink-0"
                >
                  {createSetupType.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Add
                </Button>
              </div>

              {/* Description row */}
              <div className="relative">
                <Textarea
                  placeholder="Optional description…"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value.slice(0, MAX_DESC_LENGTH))}
                  className="bg-white/5 border-white/10 text-sm resize-none pb-6 min-h-[64px]"
                  maxLength={MAX_DESC_LENGTH}
                  disabled={createSetupType.isPending}
                  rows={2}
                />
                <span
                  className={`absolute right-3 bottom-2 text-[11px] tabular-nums pointer-events-none transition-colors ${
                    newDesc.length >= MAX_DESC_LENGTH
                      ? "text-amber-400"
                      : "text-muted-foreground/40"
                  }`}
                >
                  {newDesc.length}/{MAX_DESC_LENGTH}
                </span>
              </div>

              <p className="text-[11px] text-muted-foreground/50">
                A color will be auto-assigned. Press Enter to add quickly.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
