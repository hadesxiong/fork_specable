import { useState, useMemo, useCallback } from "react";
import { AlertTriangle, Play, Loader2, X } from "lucide-react";
import { useEditorStore } from "../../store";
import type { OpenAPIV3 } from "openapi-types";
import { OperationSelector } from "./OperationSelector";
import { ServerSelector } from "./ServerSelector";
import { ParameterForm } from "./ParameterForm";
import { AuthConfig } from "./AuthConfig";
import { RequestBodyEditor } from "./RequestBodyEditor";
import { ResponseDisplay } from "./ResponseDisplay";
import { CopySnippetButton } from "./CopySnippetButton";
import { executeRequest } from "./request-execution";

export function TryItOutView() {
  const parsedSpec = useEditorStore((state) => state.parsedSpec);
  const tryIt = useEditorStore((state) => state.tryIt);
  const setTryItExecuting = useEditorStore((state) => state.setTryItExecuting);
  const setTryItResponse = useEditorStore((state) => state.setTryItResponse);

  const [corsWarningDismissed, setCorsWarningDismissed] = useState(false);

  const selectedOperation = useMemo(() => {
    if (!parsedSpec?.paths || !tryIt.selectedOperationId) return null;

    // Parse operationId format: "paths./users/{id}.get"
    const match = tryIt.selectedOperationId.match(/^paths\.(.+)\.(\w+)$/);
    if (!match) return null;

    const [, path, method] = match;
    const pathItem = parsedSpec.paths[path];
    if (!pathItem) return null;

    const operation = pathItem[method as keyof typeof pathItem] as
      | OpenAPIV3.OperationObject
      | undefined;
    if (!operation) return null;

    return { path, method: method.toUpperCase(), operation, pathItem };
  }, [parsedSpec, tryIt.selectedOperationId]);

  const serverUrl = useMemo(() => {
    if (tryIt.selectedServer === "__custom__") {
      return tryIt.customServerUrl;
    }
    if (tryIt.selectedServer) {
      return tryIt.selectedServer;
    }
    return parsedSpec?.servers?.[0]?.url ?? "";
  }, [tryIt.selectedServer, tryIt.customServerUrl, parsedSpec?.servers]);

  const canExecute = useMemo(() => {
    return (
      selectedOperation !== null && serverUrl.length > 0 && !tryIt.isExecuting
    );
  }, [selectedOperation, serverUrl, tryIt.isExecuting]);

  const handleExecute = useCallback(async () => {
    if (!selectedOperation || !serverUrl) return;

    setTryItExecuting(true);

    try {
      const response = await executeRequest({
        method: selectedOperation.method,
        baseUrl: serverUrl,
        path: selectedOperation.path,
        parameterValues: tryIt.parameterValues,
        body: tryIt.requestBody,
        contentType: tryIt.requestContentType,
        auth: tryIt.authConfig,
      });

      setTryItResponse(response);

      // Show CORS warning again if we hit a CORS error
      if (response.isCorsError) {
        setCorsWarningDismissed(false);
      }
    } catch (error) {
      setTryItResponse({
        status: 0,
        statusText: "Error",
        headers: {},
        body: "",
        responseTimeMs: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [
    selectedOperation,
    serverUrl,
    tryIt,
    setTryItExecuting,
    setTryItResponse,
  ]);

  const needsRequestBody = useMemo(() => {
    const method = selectedOperation?.method?.toUpperCase();
    return method === "POST" || method === "PUT" || method === "PATCH";
  }, [selectedOperation?.method]);

  if (!parsedSpec) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950 text-zinc-500">
        <p className="text-sm">No valid specification loaded</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* CORS Warning Banner */}
      {!corsWarningDismissed && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border-b border-amber-500/20">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-amber-200">
              Requests are made directly from your browser. APIs must have CORS
              enabled to respond.
            </p>
          </div>
          <button
            onClick={() => setCorsWarningDismissed(true)}
            className="p-1 rounded hover:bg-amber-500/20 text-amber-400 transition-colors"
            aria-label="Dismiss warning"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Operation & Server Selection */}
          <div className="space-y-3">
            <OperationSelector spec={parsedSpec} />
            <ServerSelector spec={parsedSpec} />
          </div>

          {/* Parameters */}
          {selectedOperation && (
            <ParameterForm
              operation={selectedOperation.operation}
              pathItem={selectedOperation.pathItem}
              spec={parsedSpec}
            />
          )}

          {/* Authentication */}
          <AuthConfig />

          {/* Request Body */}
          {needsRequestBody && selectedOperation && (
            <RequestBodyEditor
              operation={selectedOperation.operation}
              spec={parsedSpec}
            />
          )}

          {/* Execute Button */}
          <div className="flex gap-2">
            <button
              onClick={handleExecute}
              disabled={!canExecute}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-colors ${
                canExecute
                  ? "bg-purple-600 text-white hover:bg-purple-700"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              }`}
            >
              {tryIt.isExecuting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Send Request
                </>
              )}
            </button>
            {selectedOperation && (
              <CopySnippetButton
                method={selectedOperation.method}
                path={selectedOperation.path}
                serverUrl={serverUrl}
              />
            )}
          </div>

          {/* Response */}
          {tryIt.lastResponse && (
            <ResponseDisplay response={tryIt.lastResponse} />
          )}
        </div>
      </div>
    </div>
  );
}
