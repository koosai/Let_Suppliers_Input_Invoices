const SUPPORTED_LANGS = ["en", "tr", "zh"];
const API_URL = "https://your-domain.com/api/upload-invoice";

const state = {
  lang: "en",
  translations: {}
};

const form = document.getElementById("invoice-form");
const languageSelect = document.getElementById("language-select");
const submitButton = document.getElementById("submit-btn");

const textMap = {
  "page-title": "title",
  "language-label": "language",
  "label-employee_name": "employee_name",
  "label-employee_email": "employee_email",
  "label-invoice_no": "invoice_no",
  "label-invoice_file": "invoice_file",
  "submit-btn": "submit"
};

function t(key) {
  return state.translations[state.lang]?.[key] ?? state.translations.en?.[key] ?? key;
}

function detectLanguage() {
  const params = new URLSearchParams(window.location.search);
  const queryLang = params.get("lang");
  if (SUPPORTED_LANGS.includes(queryLang)) {
    return queryLang;
  }

  const storedLang = localStorage.getItem("lang");
  if (SUPPORTED_LANGS.includes(storedLang)) {
    return storedLang;
  }

  return "en";
}

function setLanguage(lang) {
  state.lang = SUPPORTED_LANGS.includes(lang) ? lang : "en";
  localStorage.setItem("lang", state.lang);
  languageSelect.value = state.lang;

  Object.entries(textMap).forEach(([elementId, key]) => {
    const node = document.getElementById(elementId);
    if (node) {
      node.textContent = t(key);
    }
  });
}

function clearMessages() {
  document.getElementById("success-message").textContent = "";
  document.getElementById("server-error").textContent = "";
}

function setFieldError(field, message = "") {
  const errorNode = document.getElementById(`error-${field}`);
  if (errorNode) {
    errorNode.textContent = message;
  }
}

function validateForm() {
  let valid = true;

  const employeeName = document.getElementById("employee_name");
  const employeeEmail = document.getElementById("employee_email");
  const invoiceNo = document.getElementById("invoice_no");
  const invoiceFile = document.getElementById("invoice_file");

  setFieldError("employee_name");
  setFieldError("employee_email");
  setFieldError("invoice_no");
  setFieldError("invoice_file");

  if (!employeeName.value.trim()) {
    setFieldError("employee_name", t("required"));
    valid = false;
  }

  if (!employeeEmail.value.trim()) {
    setFieldError("employee_email", t("required"));
    valid = false;
  } else if (!employeeEmail.checkValidity()) {
    setFieldError("employee_email", t("invalid_email"));
    valid = false;
  }

  if (!invoiceNo.value.trim()) {
    setFieldError("invoice_no", t("required"));
    valid = false;
  }

  const file = invoiceFile.files?.[0];
  const isPdf = file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
  if (!file) {
    setFieldError("invoice_file", t("required"));
    valid = false;
  } else if (!isPdf) {
    setFieldError("invoice_file", t("invalid_pdf"));
    valid = false;
  }

  return valid;
}

async function handleSubmit(event) {
  event.preventDefault();
  clearMessages();

  if (!validateForm()) {
    return;
  }

  submitButton.disabled = true;

  const formData = new FormData(form);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: formData
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 409 && data.code === "INVOICE_EXISTS") {
        document.getElementById("server-error").textContent = t("invoice_exists");
      } else {
        document.getElementById("server-error").textContent = t("upload_failed");
      }
      return;
    }

    const message = t("success")
      .replace("{id}", data.id ?? "-")
      .replace("{saved_filename}", data.saved_filename ?? "-");

    document.getElementById("success-message").textContent = message;
    form.reset();
  } catch {
    document.getElementById("server-error").textContent = t("upload_failed");
  } finally {
    submitButton.disabled = false;
  }
}

async function init() {
  const response = await fetch("./i18n.json");
  state.translations = await response.json();

  const lang = detectLanguage();
  setLanguage(lang);

  languageSelect.addEventListener("change", (event) => {
    setLanguage(event.target.value);
    clearMessages();
  });

  form.addEventListener("submit", handleSubmit);
}

init();
