(() => {
  'use strict';

  const messages = Object.freeze({
    DNI: 'El DNI debe contener exactamente 8 dígitos numéricos.',
    CE: 'El Carné de Extranjería debe contener más de 8 caracteres y tener un formato válido.',
  });

  function bindIdentityValidation(form) {
    if (!(form instanceof HTMLFormElement) || form.dataset.identityValidation === 'true') return;
    const typeField = form.elements.namedItem('documentType');
    const documentField = form.elements.namedItem('document');
    if (!(typeField instanceof HTMLSelectElement) || !(documentField instanceof HTMLInputElement)) return;

    form.dataset.identityValidation = 'true';
    const label = documentField.closest('label');
    if (!label) return;

    label.classList.add('identity-document-field');
    const error = document.createElement('small');
    error.className = 'identity-document-error';
    error.id = `identity-document-error-${Math.random().toString(36).slice(2)}`;
    error.setAttribute('aria-live', 'polite');
    error.hidden = true;
    label.append(error);
    documentField.setAttribute('aria-describedby', error.id);

    let touched = false;
    const isForeignCard = () => typeField.value === 'CE';

    const applyHtmlRules = () => {
      const foreignCard = isForeignCard();
      documentField.required = true;
      documentField.minLength = foreignCard ? 9 : 8;
      documentField.maxLength = foreignCard ? 15 : 8;
      documentField.pattern = foreignCard ? '[A-Za-z0-9]{9,15}' : '[0-9]{8}';
      documentField.inputMode = foreignCard ? 'text' : 'numeric';
      documentField.autocomplete = 'off';
      documentField.placeholder = foreignCard ? 'Más de 8 letras o números' : '8 dígitos';
      documentField.title = messages[foreignCard ? 'CE' : 'DNI'];
    };

    const normalizeValue = () => {
      const foreignCard = isForeignCard();
      const normalized = foreignCard
        ? documentField.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
        : documentField.value.replace(/\D/g, '');
      documentField.value = normalized.slice(0, foreignCard ? 15 : 8);
    };

    const currentError = () => {
      const value = documentField.value;
      if (isForeignCard()) return /^[A-Z0-9]{9,15}$/.test(value) ? '' : messages.CE;
      return /^\d{8}$/.test(value) ? '' : messages.DNI;
    };

    const validate = (show = false) => {
      applyHtmlRules();
      normalizeValue();
      const message = currentError();
      documentField.setCustomValidity(message);
      const visible = Boolean(message) && (show || touched);
      label.classList.toggle('is-invalid', visible);
      documentField.setAttribute('aria-invalid', String(Boolean(message)));
      error.textContent = visible ? message : '';
      error.hidden = !visible;
      return !message;
    };

    typeField.addEventListener('change', () => {
      touched = Boolean(documentField.value);
      validate(touched);
    });
    documentField.addEventListener('focus', applyHtmlRules);
    documentField.addEventListener('input', () => {
      touched = true;
      validate(true);
    });
    documentField.addEventListener('blur', () => {
      touched = true;
      validate(true);
    });
    documentField.addEventListener('invalid', () => validate(true));

    form.addEventListener('submit', (event) => {
      touched = true;
      if (validate(true)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      documentField.focus();
      documentField.reportValidity();
    }, true);

    validate(false);
  }

  const bindWithin = (rootElement) => {
    if (rootElement instanceof HTMLFormElement) bindIdentityValidation(rootElement);
    rootElement.querySelectorAll?.('form').forEach(bindIdentityValidation);
  };

  bindWithin(document);
  new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
      if (node instanceof Element) bindWithin(node);
    }));
  }).observe(document.body, { childList: true, subtree: true });
})();
