import { useEffect, useRef } from "react";
import { useEditorStore } from "../store";
import {
  getValidationPipeline,
  lintToValidationErrors,
} from "../services/validation-pipeline";

export function useValidation() {
  const file = useEditorStore((state) => state.file);
  const setValidating = useEditorStore((state) => state.setValidating);
  const setValidationResult = useEditorStore(
    (state) => state.setValidationResult,
  );
  const setParsedSpec = useEditorStore((state) => state.setParsedSpec);
  const pipelineRef = useRef(getValidationPipeline());
  const lastContentRef = useRef<string | null>(null);

  useEffect(() => {
    if (!file) return;

    const content = file.content;

    // Skip if content hasn't changed
    if (content === lastContentRef.current) return;

    // Skip empty content
    if (!content) return;

    const pipeline = pipelineRef.current;

    setValidating(true);

    pipeline
      .validateDebounced(content, (stage, result) => {
        if (stage === "validating" && result.validation) {
          // Update parsed spec immediately when available
          setParsedSpec(
            result.validation.parsedSpec,
            result.validation.sourceMap,
          );
        }
      })
      .then((result) => {
        // Mark this content as validated only after successful completion
        lastContentRef.current = content;

        const { validation, lint } = result;

        if (validation) {
          // Combine validation errors with lint diagnostics
          const lintErrors = lint ? lintToValidationErrors(lint) : [];
          const allErrors = [
            ...validation.errors,
            ...lintErrors.filter((e) => e.severity === "error"),
          ];
          const allWarnings = [
            ...validation.warnings,
            ...lintErrors.filter(
              (e) => e.severity === "warning" || e.severity === "info",
            ),
          ];

          setValidationResult({
            syntaxValid: validation.syntaxValid,
            schemaValid: validation.schemaValid,
            errors: allErrors,
            warnings: allWarnings,
          });

          setParsedSpec(validation.parsedSpec, validation.sourceMap);
        }

        setValidating(false);
      })
      .catch((e) => {
        setValidating(false);
        if (e.message !== "Validation cancelled") {
          console.error("Validation error:", e);
        }
      });

    return () => {
      pipeline.cancel();
    };
  }, [file?.content, setValidating, setValidationResult, setParsedSpec]);
}
