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
  const isFirstValidation = useRef(true);

  useEffect(() => {
    if (!file) return;

    const content = file.content;

    // Skip if content hasn't changed
    if (content === lastContentRef.current) return;

    // Skip empty content
    if (!content) return;

    let active = true;
    const pipeline = pipelineRef.current;

    const debounceMs = isFirstValidation.current ? 0 : 300;
    isFirstValidation.current = false;

    setValidating(true);

    pipeline
      .validateDebounced(content, (stage, result) => {
        if (!active) return;
        if (stage === "validating" && result.validation?.parsedSpec) {
          setParsedSpec(
            result.validation.parsedSpec,
            result.validation.sourceMap,
          );
        }
      }, debounceMs)
      .then((result) => {
        if (!active) return;

        lastContentRef.current = content;

        const { validation, lint } = result;

        if (validation) {
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

          if (validation.parsedSpec) {
            setParsedSpec(validation.parsedSpec, validation.sourceMap);
          }
        }

        setValidating(false);
      })
      .catch((e) => {
        if (!active) return;
        setValidating(false);
        if (e.message !== "Validation cancelled") {
          console.error("Validation error:", e);
        }
      });

    return () => {
      active = false;
      pipeline.cancel();
    };
  }, [file?.content, setValidating, setValidationResult, setParsedSpec]);
}
