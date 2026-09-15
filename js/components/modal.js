const Modal = {
  open({ title, fields = [], submitText = "Save", onSubmit, danger = false, wide = false, grouped = false }) {
    const root = document.getElementById("modalRoot");
    const fieldHtml = grouped ? this.groupedFields(fields) : this.fields(fields);

    root.innerHTML = `
      <form class="modal glass-card ${wide ? "modal-wide" : ""} ${grouped ? "modal-setup" : ""}" id="modalForm" novalidate>
        <div class="between">
          <h2 class="section-title">${title}</h2>
          <button class="icon-button" type="button" data-close aria-label="Close">${Icons.close()}</button>
        </div>
        ${fieldHtml}
        <div class="between" style="margin-top:18px">
          <button class="button ghost-button" type="button" data-close>${t("cancel")}</button>
          <button class="button ${danger ? "danger-button" : ""}" type="submit">${submitText}</button>
        </div>
      </form>
    `;
    root.classList.add("open");

    root.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => this.close()));
    if (grouped) this.bindGroups(root);
    this.bindImageFileInputs(root);
    root.querySelector("#modalForm").addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form).entries());
      fields.filter(field => field.type === "checkbox").forEach(field => {
        data[field.name] = form.elements[field.name]?.checked || false;
      });
      await Promise.all(fields.filter(field => field.type === "file").map(async field => {
        const file = form.elements[field.name]?.files?.[0];
        data[field.name] = file ? await readFile(file) : field.value || "";
        const positionField = form.elements[`${field.name}Position`];
        if (positionField) {
          try {
            data[`${field.name}Position`] = JSON.parse(positionField.value || "{}") || { x: 0, y: 0 };
          } catch (error) {
            data[`${field.name}Position`] = { x: 0, y: 0 };
          }
        }
      }));

      const errors = {};
      fields.forEach(field => {
        if (field.required && !String(data[field.name] || "").trim()) errors[field.name] = t("required");
        if (field.type === "number" && data[field.name] && Number(data[field.name]) < 0) errors[field.name] = t("positiveAmount");
      });
      root.querySelectorAll("[data-error]").forEach(slot => slot.textContent = errors[slot.dataset.error] || "");
      if (Object.keys(errors).length) {
        if (grouped) {
          const firstError = Object.keys(errors)[0];
          const slot = root.querySelector(`[data-error="${firstError}"]`);
          const panel = slot?.closest("[data-setup-panel]");
          if (panel) this.showGroup(root, panel.dataset.setupPanel);
        }
        return;
      }
      onSubmit(data);
      this.close();
    });
  },
  fields(fields) {
    return `<div class="form-grid">${fields.map(field => this.field(field)).join("")}</div>`;
  },
  field(field) {
    if (field.type === "heading") {
      return `
        <div class="field-heading">
          <h3>${escapeHtml(field.label)}</h3>
          ${field.description ? `<p class="secondary">${escapeHtml(field.description)}</p>` : ""}
        </div>
      `;
    }
    return `
      <div class="field ${field.type === "checkbox" ? "field-inline" : ""}">
        <label for="${field.name}">${field.label}</label>
        ${this.input(field)}
        <span class="field-error" data-error="${field.name}"></span>
      </div>
    `;
  },
  groupedFields(fields) {
    const groups = [];
    let current = null;
    fields.forEach(field => {
      if (field.type === "heading") {
        current = { id: `setup-section-${groups.length}`, label: field.label, description: field.description || "", icon: field.icon || "", fields: [] };
        groups.push(current);
        return;
      }
      if (!current) {
        current = { id: "details", label: "Details", description: "", icon: "", fields: [] };
        groups.push(current);
      }
      current.fields.push(field);
    });

    return `
      <div class="setup-layout">
        <nav class="setup-sidebar" aria-label="Create user sections">
          ${groups.map((group, index) => `<button class="setup-tab ${index === 0 ? "active" : ""}" type="button" data-setup-tab="${group.id}">${group.icon || ""}<span>${escapeHtml(group.label)}</span></button>`).join("")}
        </nav>
        <div class="setup-panels">
          ${groups.map((group, index) => `
            <section class="setup-panel ${index === 0 ? "active" : ""}" data-setup-panel="${group.id}">
              <div class="field-heading">
                <h3>${escapeHtml(group.label)}</h3>
                ${group.description ? `<p class="secondary">${escapeHtml(group.description)}</p>` : ""}
              </div>
              <div class="form-grid">${group.fields.map(field => this.field(field)).join("")}</div>
            </section>
          `).join("")}
        </div>
      </div>
    `;
  },
  bindGroups(root) {
    root.querySelectorAll("[data-setup-tab]").forEach(button => {
      button.addEventListener("click", () => this.showGroup(root, button.dataset.setupTab));
    });
  },
  showGroup(root, groupId) {
    root.querySelectorAll("[data-setup-tab]").forEach(button => button.classList.toggle("active", button.dataset.setupTab === groupId));
    root.querySelectorAll("[data-setup-panel]").forEach(panel => panel.classList.toggle("active", panel.dataset.setupPanel === groupId));
    root.querySelector(".setup-panels")?.scrollTo({ top: 0 });
  },
  confirm({ title, message, confirmText = "Confirm", onConfirm }) {
    this.open({
      title,
      danger: true,
      submitText: confirmText,
      fields: [{ name: "confirmation", label: message, value: "yes", type: "hidden" }],
      onSubmit: onConfirm
    });
  },
  input(field) {
    const required = field.required ? "required" : "";
    const value = field.value ?? "";
    if (field.type === "hidden") return `<input id="${field.name}" name="${field.name}" type="hidden" value="${escapeAttr(value)}">`;
    if (field.type === "select") {
      return `<select id="${field.name}" name="${field.name}" ${required}>${field.options.map(option => `<option value="${escapeAttr(option)}" ${option === value ? "selected" : ""}>${escapeHtml(optionLabel(option))}</option>`).join("")}</select>`;
    }
    if (field.type === "textarea") {
      return `<textarea id="${field.name}" name="${field.name}" ${required}>${escapeHtml(value)}</textarea>`;
    }
    if (field.type === "checkbox") {
      return `<input id="${field.name}" name="${field.name}" type="checkbox" ${value ? "checked" : ""}>`;
    }
    if (field.type === "file") {
      return `<input id="${field.name}" name="${field.name}" type="file" accept="image/*" ${required}>`;
    }
    return `<input id="${field.name}" name="${field.name}" type="${field.type || "text"}" value="${escapeAttr(value)}" ${required}>`;
  },
  close() {
    const root = document.getElementById("modalRoot");
    root.classList.remove("open");
    root.innerHTML = "";
  },
  bindImageFileInputs(root) {
    root.querySelectorAll('input[type="file"][accept*="image"]').forEach(input => {
      input.addEventListener("change", event => {
        const file = event.target.files?.[0];
        if (!file || !file.type?.startsWith("image/")) return;

        const field = input.closest(".field");
        if (!field) return;

        const existing = field.querySelector(".image-position-preview");
        const frame = existing || document.createElement("div");
        frame.className = "image-position-preview";
        frame.innerHTML = `
          <div class="image-position-frame" data-image-position-frame>
            <img data-image-position="${input.name}" alt="" src="">
          </div>
          <div class="image-position-hint">${t("dragToAdjust") || "Drag to adjust"}</div>
        `;

        if (!existing) field.appendChild(frame);
        const previewImage = frame.querySelector("img");
        const previewFrame = frame.querySelector(".image-position-frame");
        const positionField = field.querySelector(`input[name="${input.name}Position"]`) || document.createElement("input");
        positionField.type = "hidden";
        positionField.name = `${input.name}Position`;
        positionField.value = JSON.stringify({ x: 0, y: 0 });
        if (!field.querySelector(`input[name="${input.name}Position"]`)) field.appendChild(positionField);

        const image = new Image();
        const objectUrl = URL.createObjectURL(file);
        image.onload = () => {
          previewImage.src = image.src;
          previewImage.onload = () => URL.revokeObjectURL(objectUrl);
          previewImage.style.setProperty("--image-position-x", "0%");
          previewImage.style.setProperty("--image-position-y", "0%");
          previewImage.dataset.imagePosition = input.name;
          previewImage.setAttribute("data-image-position", input.name);
          previewImage.classList.add("draggable-image");

          let dragStart;
          const updatePosition = (clientX, clientY) => {
            const bounds = previewFrame.getBoundingClientRect();
            const x = clamp((Number.parseFloat(previewImage.style.getPropertyValue("--image-position-x")) || 0) + ((clientX - dragStart.x) / bounds.width) * 100, -50, 50);
            const y = clamp((Number.parseFloat(previewImage.style.getPropertyValue("--image-position-y")) || 0) + ((clientY - dragStart.y) / bounds.height) * 100, -50, 50);
            previewImage.style.setProperty("--image-position-x", `${x}%`);
            previewImage.style.setProperty("--image-position-y", `${y}%`);
            positionField.value = JSON.stringify({ x, y });
          };

          previewImage.addEventListener("pointerdown", event => {
            event.preventDefault();
            previewImage.setPointerCapture(event.pointerId);
            dragStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
            previewImage.classList.add("is-image-dragging");
          });
          previewImage.addEventListener("pointermove", event => {
            if (!dragStart || dragStart.pointerId !== event.pointerId) return;
            updatePosition(event.clientX, event.clientY);
            dragStart = { ...dragStart, x: event.clientX, y: event.clientY };
          });
          previewImage.addEventListener("pointerup", () => {
            dragStart = null;
            previewImage.classList.remove("is-image-dragging");
          });
          previewImage.addEventListener("pointercancel", () => {
            dragStart = null;
            previewImage.classList.remove("is-image-dragging");
          });
        };
        image.onerror = () => URL.revokeObjectURL(objectUrl);
        image.src = objectUrl;
      });
    });
  }
};

async function readFile(file) {
  if (file.type?.startsWith("image/")) return readImageFile(file);
  return readRawFile(file);
}

function readRawFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxSize = 1280;
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image could not be loaded"));
    };
    image.src = objectUrl;
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
