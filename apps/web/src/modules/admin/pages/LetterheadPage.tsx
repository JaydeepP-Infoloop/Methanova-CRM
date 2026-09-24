import { useState } from "react";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { Field } from "../../../components/Field";
import { FileDrop } from "../../../components/FileDrop";
import { LetterheadPreview } from "../../../components/LetterheadPreview";
import { PageHeader } from "../../../components/PagePrimitives";
import { useToast } from "../../../components/Toast";
import { ApiError } from "../../../lib/apiClient";
import { fileToDataUrl, useOrgLetterhead, usePatchOrgLetterhead, useUploadOrgLogo } from "../api/letterhead.api";

export function LetterheadPage() {
  const { data, isLoading, error } = useOrgLetterhead();
  const patch = usePatchOrgLetterhead();
  const upload = useUploadOrgLogo();
  const toast = useToast();
  const [legalName, setLegalName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const name = legalName || data?.legalName || "Methanova Pvt Ltd";

  async function saveName() {
    setFormError(null);
    try {
      await patch.mutateAsync({ legalName: name });
      toast({ message: "Legal name saved" });
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : "Could not save.");
    }
  }

  async function onFile(file: File) {
    setFormError(null);
    try {
      await upload.mutateAsync({ filename: file.name, dataBase64: await fileToDataUrl(file) });
      toast({ message: "Org logo replaced" });
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : "Upload refused.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Org letterhead"
        subtitle="One Methanova mark for documents. Project pages may override it; the CRM chrome stays green and gold."
      />
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {error && <p className="text-sm text-rose-700">{(error as Error).message}</p>}
      {data && (
        <div className="space-y-4">
          <Card>
            <LetterheadPreview fileId={data.fileId} legalName={name} projectName="Sample plant" projectCode="PRJ-DEMO" />
            <div className="mt-4 max-w-md">
              <Field label="Legal name" htmlFor="legal">
                <input
                  id="legal"
                  value={legalName || data.legalName}
                  onChange={(event) => setLegalName(event.target.value)}
                />
              </Field>
              <div className="mt-3">
                <Button size="sm" onClick={() => void saveName()} isPending={patch.isPending} pendingLabel="Saving…">
                  Save name
                </Button>
              </div>
            </div>
            <div className="mt-4 max-w-md">
              <FileDrop disabled={upload.isPending} onFile={(file) => void onFile(file)} />
            </div>
            {formError && <p className="mt-3 text-sm text-rose-700">{formError}</p>}
          </Card>
        </div>
      )}
    </div>
  );
}
