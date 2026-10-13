const SmartAssistant = {
  drafts: [],
  open() {
    Modal.open({
      title: t("smartAssistant"),
      submitText: t("addDetectedData"),
      wide: true,
      fields: [
        { name: "assistantText", label: t("smartAssistantInput"), type: "textarea", value: "", required: true }
      ],
      onSubmit: data => this.saveDrafts(this.parse(data.assistantText))
    });
    this.mountPreview();
  },
  mountPreview() {
    const form = document.getElementById("modalForm");
    const textarea = form?.elements.assistantText;
    if (!form || !textarea) return;
    const preview = document.createElement("div");
    preview.className = "assistant-preview";
    preview.innerHTML = `<h3>${t("assistantPreview")}</h3><div data-assistant-preview>${t("assistantExample")}</div>`;
    textarea.closest(".field").appendChild(preview);
    const update = () => {
      this.drafts = this.parse(textarea.value);
      preview.querySelector("[data-assistant-preview]").innerHTML = this.renderPreview(this.drafts);
    };
    textarea.placeholder = t("assistantPlaceholder");
    textarea.addEventListener("input", update);
    update();
  },
  parse(text) {
    return String(text || "").split(/\n+/).map(line => this.parseLine(line.trim())).filter(Boolean);
  },
  parseLine(line) {
    if (!line) return null;
    const lower = line.toLowerCase();
    const kind = this.detectKind(lower);
    const amount = this.extractAmount(line);
    const date = this.extractDate(line);
    const currency = this.extractCurrency(line);
    const cleanName = this.cleanName(line);

    if (kind === "bill") {
      return draft("bills", t("bill"), {
        name: cleanName || t("bill"),
        amount: amount.value,
        currency,
        due: date,
        frequency: this.extractFrequency(lower, "Monthly"),
        category: this.detectMoneyCategory(lower, "Bills"),
        reminder: true,
        status: "Upcoming",
        notes: line
      });
    }
    if (kind === "savings") {
      return draft("savings", t("savings"), {
        name: cleanName || t("savings"),
        targetAmount: amount.value,
        currentAmount: this.extractCurrentAmount(line),
        monthlyContribution: this.extractContribution(line),
        currency,
        deadline: date,
        notes: line
      });
    }
    if (kind === "event") {
      return draft("calendarEvents", t("calendarEvent"), {
        title: cleanName || t("calendarEvent"),
        date: date || new Date().toISOString().slice(0, 10),
        time: this.extractTime(line),
        category: this.detectEventCategory(lower),
        familyMember: "",
        reminder: true,
        notes: line
      });
    }
    if (kind === "loan") {
      return draft("loans", t("loan"), {
        name: cleanName || t("loan"),
        originalAmount: amount.value,
        currency,
        interestRate: this.extractPercent(line),
        monthlyPayment: this.extractPaymentAmount(line),
        paymentFrequency: this.extractFrequency(lower, "Monthly"),
        startDate: date,
        dueDate: this.extractDueDate(line),
        notes: line,
        payments: []
      });
    }
    if (kind === "income") {
      return draft("income", t("income"), {
        name: cleanName || t("income"),
        amount: amount.value,
        currency,
        category: this.detectIncomeCategory(lower),
        frequency: this.extractFrequency(lower, "Monthly"),
        nextPaymentDate: date,
        recurring: true,
        notes: line
      });
    }
    if (kind === "expense") {
      return draft("expenses", t("expense"), {
        description: cleanName || t("expense"),
        amount: amount.value,
        currency,
        category: this.detectMoneyCategory(lower, "Other"),
        date: date || new Date().toISOString().slice(0, 10),
        method: this.detectPaymentMethod(lower),
        notes: line
      });
    }
    if (kind === "goal") {
      return draft("goals", t("goal"), {
        name: cleanName || t("goal"),
        category: this.detectGoalCategory(lower),
        targetAmount: amount.value,
        currentAmount: 0,
        deadline: date,
        description: line,
        contributions: []
      });
    }
    if (kind === "memory") {
      return draft("memories", t("memory"), {
        title: cleanName || t("memory"),
        photo: "",
        date: date || new Date().toISOString().slice(0, 10),
        location: this.extractAfter(line, ["at", "in", "នៅ"]),
        description: line,
        familyMembers: "",
        tags: this.detectMemoryTags(lower)
      });
    }
    if (kind === "family") {
      return draft("family", t("family"), {
        name: cleanName || t("family"),
        relationship: this.detectRelationship(lower),
        birthday: date,
        phone: this.extractPhone(line),
        notes: line,
        photo: ""
      });
    }
    return null;
  },
  renderPreview(items) {
    if (!items.length) return `<p class="secondary">${t("assistantExample")}</p>`;
    return `<div class="list">${items.map(item => `<div class="list-row assistant-row"><span class="icon-badge green">${Icons.spark()}</span><strong>${escapeHtml(item.type)}</strong><span><b>${escapeHtml(item.label)}</b><small>${escapeHtml(this.previewDetails(item))}</small></span><span class="pill">${item.collection}</span></div>`).join("")}</div>`;
  },
  previewDetails(item) {
    const data = item.data;
    const amount = data.amount ?? data.targetAmount ?? data.originalAmount;
    const date = data.due || data.date || data.deadline || data.startDate || data.birthday || "";
    const parts = [];
    if (amount) parts.push(`${data.currency || appData.profile.currency || "USD"} ${Number(amount).toLocaleString("en-US")}`);
    if (data.category) parts.push(optionLabel(data.category));
    if (data.frequency || data.paymentFrequency) parts.push(optionLabel(data.frequency || data.paymentFrequency));
    if (date) parts.push(date);
    return parts.join(" · ");
  },
  saveDrafts(items) {
    if (!items.length) {
      Toast.show(t("assistantNothingFound"));
      return;
    }
    items.forEach(item => appData[item.collection].push({ id: id(item.collection), createdAt: new Date().toISOString(), ...item.data }));
    Store.save();
    App.render();
    Toast.show(`${items.length} ${t("assistantAdded")}`);
  },
  extractAmount(line) {
    const withoutPhone = line.replace(/\+?\d[\d\s-]{6,}\d/g, " ");
    const match = withoutPhone.match(/(?:\$|usd|khr|riel|៛)?\s*([0-9]+(?:[,.][0-9]{1,3})*(?:\.[0-9]+)?)(\s*[km])?/i);
    return { value: match ? this.normalizeAmount(match[1], match[2]) : 0 };
  },
  normalizeAmount(value, suffix = "") {
    const amount = Number(String(value).replace(/,/g, ""));
    if (/m/i.test(suffix)) return amount * 1000000;
    if (/k/i.test(suffix)) return amount * 1000;
    return amount;
  },
  extractCurrency(line) {
    return /khr|riel|៛|រៀល/i.test(line) ? "KHR" : /usd|\$/i.test(line) ? "USD" : appData.profile.currency || "USD";
  },
  extractDate(line) {
    const iso = line.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    const short = line.match(/\b(\d{1,2})[-/](\d{1,2})(?:[-/](20\d{2}))?\b/);
    if (short) {
      const year = short[3] || String(new Date().getFullYear());
      return `${year}-${short[2].padStart(2, "0")}-${short[1].padStart(2, "0")}`;
    }
    const monthYear = line.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(20\d{2})\b/i);
    if (monthYear) {
      const monthIndex = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(monthYear[1].slice(0, 3).toLowerCase()) + 1;
      return `${monthYear[2]}-${String(monthIndex).padStart(2, "0")}-01`;
    }
    const month = line.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:,?\s*(20\d{2}))?/i);
    if (month) {
      const monthIndex = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(month[1].slice(0, 3).toLowerCase()) + 1;
      return `${month[3] || new Date().getFullYear()}-${String(monthIndex).padStart(2, "0")}-${month[2].padStart(2, "0")}`;
    }
    const dueDay = line.match(/\b(?:due|on|day|ថ្ងៃទី)\s*(\d{1,2})\b/i);
    if (dueDay) {
      const today = new Date();
      const candidate = new Date(today.getFullYear(), today.getMonth(), Number(dueDay[1]));
      if (candidate < today) candidate.setMonth(candidate.getMonth() + 1);
      return this.localIso(candidate);
    }
    const lower = line.toLowerCase();
    const today = new Date();
    if (lower.includes("tomorrow")) today.setDate(today.getDate() + 1);
    else if (lower.includes("next week")) today.setDate(today.getDate() + 7);
    else if (lower.includes("next month")) today.setMonth(today.getMonth() + 1);
    else if (!lower.includes("today")) return "";
    return this.localIso(today);
  },
  localIso(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  },
  extractDueDate(line) {
    const duePart = line.match(/\b(?:due|end|finish|until)\s+(.+)$/i);
    return duePart ? this.extractDate(duePart[1]) : "";
  },
  extractTime(line) {
    const match = line.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (match) return `${match[1].padStart(2, "0")}:${match[2]}`;
    const ampm = line.match(/\b(\d{1,2})\s*(am|pm)\b/i);
    if (!ampm) return "";
    let hour = Number(ampm[1]);
    if (ampm[2].toLowerCase() === "pm" && hour < 12) hour += 12;
    if (ampm[2].toLowerCase() === "am" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:00`;
  },
  extractFrequency(lower, fallback) {
    if (lower.includes("daily")) return "Daily";
    if (lower.includes("weekly")) return "Weekly";
    if (lower.includes("yearly") || lower.includes("annual")) return "Yearly";
    if (lower.includes("once")) return "Once";
    if (lower.includes("quarter")) return "Quarterly";
    if (lower.includes("ប្រចាំថ្ងៃ")) return "Daily";
    if (lower.includes("ប្រចាំសប្តាហ៍")) return "Weekly";
    if (lower.includes("ប្រចាំឆ្នាំ")) return "Yearly";
    if (lower.includes("ប្រចាំខែ")) return "Monthly";
    return fallback;
  },
  detectKind(lower) {
    const rules = [
      ["family", ["family", "mom", "dad", "mother", "father", "wife", "husband", "son", "daughter", "birthday", "phone", "គ្រួសារ", "ម៉ាក់", "ប៉ា"]],
      ["bill", ["bill", "rent", "electric", "water", "internet", "phone", "subscription", "utility", "វិក្កយបត្រ", "ភ្លើង", "ទឹក"]],
      ["savings", ["saving", "savings", "save for", "fund", "សន្សំ"]],
      ["event", ["event", "meeting", "appointment", "reminder", "call", "ព្រឹត្តិការណ៍", "ប្រជុំ", "រំលឹក"]],
      ["loan", ["loan", "borrow", "debt", "កម្ចី", "ខ្ចី"]],
      ["income", ["income", "salary", "paycheck", "freelance", "bonus", "ចំណូល", "ប្រាក់ខែ"]],
      ["expense", ["expense", "paid", "buy", "spent", "lunch", "dinner", "coffee", "gas", "fuel", "taxi", "food", "ចំណាយ", "ទិញ"]],
      ["goal", ["goal", "target", "plan", "គោលដៅ"]],
      ["memory", ["memory", "photo", "trip", "visited", "អនុស្សាវរីយ៍", "ដំណើរ"]]
    ];
    return rules.find(([, words]) => this.hasAny(lower, words))?.[0] || "";
  },
  detectMoneyCategory(lower, fallback) {
    if (this.hasAny(lower, ["food", "lunch", "dinner", "coffee", "restaurant", "អាហារ"])) return "Food";
    if (this.hasAny(lower, ["rent", "house", "home", "ផ្ទះ"])) return "Home";
    if (this.hasAny(lower, ["school", "study", "book", "education", "សិក្សា"])) return "Education";
    if (this.hasAny(lower, ["health", "doctor", "medicine", "ពេទ្យ"])) return "Health";
    if (this.hasAny(lower, ["taxi", "gas", "fuel", "transport", "car", "ឡាន"])) return "Transport";
    if (this.hasAny(lower, ["electric", "water", "internet", "phone", "bill"])) return "Bills";
    return fallback;
  },
  detectIncomeCategory(lower) {
    if (this.hasAny(lower, ["salary", "paycheck", "ប្រាក់ខែ"])) return "Salary";
    if (this.hasAny(lower, ["business", "shop"])) return "Business";
    if (this.hasAny(lower, ["freelance", "client"])) return "Freelance";
    if (this.hasAny(lower, ["bonus"])) return "Bonus";
    return "Other";
  },
  detectGoalCategory(lower) {
    if (this.hasAny(lower, ["money", "financial", "cash"])) return "Financial";
    if (this.hasAny(lower, ["home", "house"])) return "Home";
    if (this.hasAny(lower, ["travel", "trip"])) return "Travel";
    if (this.hasAny(lower, ["health"])) return "Health";
    if (this.hasAny(lower, ["study", "education"])) return "Education";
    if (this.hasAny(lower, ["family"])) return "Family";
    return "Personal";
  },
  detectEventCategory(lower) {
    if (this.hasAny(lower, ["family", "mom", "dad"])) return "Family";
    if (this.hasAny(lower, ["bill"])) return "Bill";
    if (this.hasAny(lower, ["loan"])) return "Loan";
    if (this.hasAny(lower, ["goal"])) return "Goal";
    return "Personal";
  },
  detectPaymentMethod(lower) {
    if (this.hasAny(lower, ["card", "visa"])) return "Card";
    if (this.hasAny(lower, ["bank", "aba", "transfer"])) return "Bank";
    if (this.hasAny(lower, ["cash"])) return "Cash";
    return "";
  },
  extractCurrentAmount(line) {
    const match = line.match(/\b(?:current|have|saved)\s+(?:\$|usd|khr|riel|៛)?\s*([0-9,.]+)(\s*[km])?/i);
    return match ? this.normalizeAmount(match[1], match[2]) : 0;
  },
  extractContribution(line) {
    const match = line.match(/\b(?:monthly|per month|contribute)\s+(?:\$|usd|khr|riel|៛)?\s*([0-9,.]+)(\s*[km])?/i);
    return match ? this.normalizeAmount(match[1], match[2]) : 0;
  },
  extractPaymentAmount(line) {
    const match = line.match(/\b(?:payment|pay|installment)\s+(?:\$|usd|khr|riel|៛)?\s*([0-9,.]+)(\s*[km])?/i);
    return match ? this.normalizeAmount(match[1], match[2]) : 0;
  },
  extractPercent(line) {
    const match = line.match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
    return match ? Number(match[1]) : 0;
  },
  extractAfter(line, words) {
    const pattern = new RegExp(`(?:${words.join("|")})\\s+([^,]+)$`, "i");
    return line.match(pattern)?.[1]?.trim() || "";
  },
  extractPhone(line) {
    return line.match(/(?:\+?\d[\d\s-]{6,}\d)/)?.[0]?.trim() || "";
  },
  detectRelationship(lower) {
    if (this.hasAny(lower, ["mom", "mother", "ម៉ាក់"])) return "Mother";
    if (this.hasAny(lower, ["dad", "father", "ប៉ា"])) return "Father";
    if (this.hasAny(lower, ["wife"])) return "Wife";
    if (this.hasAny(lower, ["husband"])) return "Husband";
    if (this.hasAny(lower, ["son"])) return "Son";
    if (this.hasAny(lower, ["daughter"])) return "Daughter";
    return "";
  },
  detectMemoryTags(lower) {
    return ["family", "travel", "food", "work"].filter(tag => lower.includes(tag)).join(", ");
  },
  cleanName(line) {
    return line
      .replace(/\b(bill|saving|savings|save|event|meeting|appointment|reminder|loan|income|salary|expense|paid|buy|spent|goal|memory|photo|family|daily|weekly|monthly|yearly|annual|quarterly|once|today|tomorrow|due|usd|khr|riel|payment|pay|current|saved|target|at|in|on)\b/gi, "")
      .replace(/\b(cash|card|bank|phone|birthday|with|am|pm)\b/gi, "")
      .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi, "")
      .replace(/\+?\d[\d\s-]{6,}\d|\$|៛|\b\d{1,2}\s*(am|pm)\b|[0-9]+(?:[,.][0-9]{1,3})*(?:\.[0-9]+)?\s*[km]?|\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}[-/]\d{1,2}(?:[-/]\d{4})?\b|\b\d{1,2}:\d{2}\b|%|\/|:/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  },
  hasAny(text, words) {
    return words.some(word => text.includes(word));
  }
};

function draft(collection, type, data) {
  return { collection, type, label: data.name || data.title || data.description || type, data };
}
