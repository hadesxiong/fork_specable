import { useEffect, useRef } from 'react';
import { useEditorStore } from '../store';
import { getValidationPipeline, lintToValidationErrors } from '../services/validation-pipeline';

export function useValidation() {
  const file = useEditorStore((state) => state.file);
  const setValidating = useEditorStore((state) => state.setValidating);
  const setValidationResult = useEditorStore((state) => state.setValidationResult);
  const setParsedSpec = useEditorStore((state) => state.setParsedSpec);
  const pipelineRef = useRef(getValidationPipeline());
  const lastContentRef = useRef<string | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (!file) return;

    const content = file.content;

    // Skip if content hasn't changed (but always run on initial mount with content)
    if (content === lastContentRef.current && !isInitialMount.current) return;
    if (content && isInitialMount.current) {
      isInitialMount.current = false;
    }
    lastContentRef.current = content;

    // Skip empty content
    if (!content) return;

    const pipeline = pipelineRef.current;

    setValidating(true);

    pipeline.validateDebounced(content, (stage, result) => {
      if (stage === 'validating' && result.validation) {
        // Update parsed spec immediately when available
        setParsedSpec(result.validation.parsedSpec, result.validation.sourceMap);
      }
    }).then((result) => {
      const { validation, lint } = result;

      if (validation) {
        // Combine validation errors with lint diagnostics
        const lintErrors = lint ? lintToValidationErrors(lint) : [];
        const allErrors = [...validation.errors, ...lintErrors.filter((e) => e.severity === 'error')];
        const allWarnings = [...validation.warnings, ...lintErrors.filter((e) => e.severity === 'warning' || e.severity === 'info')];

        setValidationResult({
          syntaxValid: validation.syntaxValid,
          schemaValid: validation.schemaValid,
          errors: allErrors,
          warnings: allWarnings,
        });

        setParsedSpec(validation.parsedSpec, validation.sourceMap);
      }

      setValidating(false);
    }).catch((e) => {
      setValidating(false);
      if (e.message !== 'Validation cancelled') {
        console.error('Validation error:', e);
      }
    });

    return () => {
      pipeline.cancel();
    };
  }, [file?.content, setValidating, setValidationResult, setParsedSpec]);
}
