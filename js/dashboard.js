function renderHome() {
  const stats = Store.calculate();
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayEvents = appData.calendarEvents.filter(event => event.date === todayIso);
  const hasMoneyData = ["income", "expenses", "savings", "loans", "bills"].some(key => appData[key].length);
  const hasAnyData = appData.profile.name || ["family", "goals", "income", "expenses", "savings", "loans", "bills", "calendarEvents", "memories"].some(key => appData[key].length);
  const profileName = appData.profile.name || "Your Name";
  const firstName = profileName.split(/\s+/).filter(Boolean)[0] || "there";
  const profilePhoto = appData.profile.photo ? `<img src="${appData.profile.photo}" alt="${escapeHtml(profileName)}">` : initials(profileName);
  const todayLabel = new Date().toLocaleDateString(languageCode() === "km" ? "km-KH" : "en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  return `
    <section class="page home-featured-page">
      <div class="home-hero-panel">
        <div class="home-hero-copy">
          <span class="eyebrow">${t("privateDashboard")}</span>
          <h1 class="page-title">${t("goodMorning")}, ${escapeHtml(firstName)}</h1>
          <div class="home-date-row">
            <span class="date-icon">📅</span>
            <span class="date-line">${todayLabel}</span>
          </div>

          <div class="home-quote-row">
            <span class="quote-mark">“</span>
            <p>Small steps, big wins.</p>
            <span class="quote-arrow">›</span>
          </div>
        </div>

        <div class="home-profile-side home-profile-trigger" role="button" tabindex="0" data-action="setup-profile" aria-label="Edit profile">
          <div class="home-avatar-ring">
            <span class="home-user-avatar">${profilePhoto}</span>
          </div>
          <div class="home-profile-meta">
            <strong>${escapeHtml(profileName)}</strong>
          </div>
        </div>
      </div>

      <div class="home-quick-actions">
        <button class="home-action action-green" type="button" data-action="smart-assistant">
          <span class="action-icon">${Icons.spark()}</span>
          <span class="action-content">
            <strong>${t("smartAssistant")}</strong>
            <small>Get instant help, ideas and suggestions</small>
          </span>
          <span class="action-arrow">›</span>
        </button>

        <button class="home-action action-purple" type="button" data-action="create-user">
          <span class="action-icon">${Icons.user()}</span>
          <span class="action-content">
            <strong>${t("createUser")}</strong>
            <small>Add and manage your profiles</small>
          </span>
          <span class="action-arrow">›</span>
        </button>

        <button class="home-action action-dark" type="button" data-action="add-goal">
          <span class="action-icon">${Icons.goal()}</span>
          <span class="action-content">
            <strong>${t("createGoal")}</strong>
            <small>Set targets and track progress</small>
          </span>
          <span class="action-arrow">›</span>
        </button>

        <button class="home-action action-dark" type="button" data-action="add-event">
          <span class="action-icon">${Icons.plus()}</span>
          <span class="action-content">
            <strong>${t("addEvent")}</strong>
            <small>Plan your important moments</small>
          </span>
          <span class="action-arrow">›</span>
        </button>
      </div>

      <div class="home-reminder-panel">
        <div class="home-reminder-copy">
          <span class="eyebrow">Life Reminder</span>
          <h2>A Better You Everyday</h2>
          <p>Plan. Focus. Do. Repeat.</p>
        </div>
        <div class="home-reminder-quote">Good Things Take Time</div>
      </div>

      ${homePhotoCard()}
    </section>
  `;
}

function homeEmptyCard() {
  return `
    <article class="glass-card image-empty-card home-empty-card">
      <img src="https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=78" alt="" loading="lazy">
      <div class="image-empty-content">
        <span class="icon-badge green">${Icons.home()}</span>
        <h2>${escapeHtml(t("nothingYet"))}</h2>
        <p class="secondary">${escapeHtml(t("emptyDashboard"))}</p>
        <button class="button" data-action="create-user">${Icons.plus()} ${t("createUser")}</button>
      </div>
    </article>
  `;
}

function homePhotoCard() {
  const image = getFamilyPhoto();
  const isKhmer = languageCode() === "km";
  return `
    <article class="glass-card family-photo-card home-photo-card">
      <div class="family-photo-heading">
        <div><span class="eyebrow">${isKhmer ? "រូបថតគ្រួសារ" : "FAMILY PHOTO"}</span><h2>${isKhmer ? "រូបថតរបស់យើង" : "A photo of us"}</h2></div>
        <span class="icon-badge green">${Icons.memory()}</span>
      </div>
      <div class="family-photo-frame">
        ${image ? `<img src="${escapeAttr(image)}" alt="${isKhmer ? "រូបថតគ្រួសារ" : "Family photo"}">` : `<img src="https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=78" alt="" loading="lazy">`}
      </div>
      <label class="button family-photo-upload">${image ? (isKhmer ? "ប្តូររូបថត" : "Change photo") : (isKhmer ? "បន្ថែមរូបថត" : "Add photo")}<input type="file" accept="image/*" data-family-photo></label>
    </article>
  `;
}

function summaryCard(label, title, value, trend, icon, tone) {
  return `
    <article class="glass-card card-pad">
      <div class="card-title-row">
        <span class="secondary">${title}</span>
        <span class="icon-badge ${tone}">${icon}</span>
      </div>
      <div class="metric">${value}</div>
      <div class="secondary">${trend}</div>
    </article>
  `;
}

function goalProgress(goal) {
  return `
    <a class="goal-item" href="#goals/${goal.id}">
      ${goalProgressContent(goal)}
    </a>
  `;
}

function goalProgressContent(goal) {
  const progress = pct(goal.currentAmount, goal.targetAmount);
  return `
    <div class="between"><strong>${goal.name}</strong><span class="pill">${progress}%</span></div>
    <div class="secondary">${money(goal.currentAmount)} / ${money(goal.targetAmount)}</div>
    <div class="progress-track"><div class="progress-fill" style="--progress:${progress}%"></div></div>
  `;
}

function getTipsData() {
  return [
    {
      icon: Icons.home(), category: "HOME", title: "Our Home", khmerTitle: "ផ្ទះរបស់យើង",
      short: "Make home a place you both feel happy returning to.", khmerShort: "ធ្វើឱ្យផ្ទះក្លាយជាកន្លែងដែលយើងទាំងពីរសប្បាយចិត្តត្រឡប់មកវិញ។",
      quick: ["Help with housework", "Make the home comfortable", "Decide home matters together"],
      khmerQuick: ["ជួយគ្នាធ្វើការងារ", "រៀបចំផ្ទះឱ្យមានផាសុកភាព", "សម្រេចចិត្តរឿងផ្ទះជាមួយគ្នា"],
      detail: "Home is more than a building. It should be a safe, warm place for both partners.",
      khmerDetail: "ផ្ទះមិនមែនគ្រាន់តែជាអគារទេ។ វាជាកន្លែងដែលគូស្នេហ៍គួរមានអារម្មណ៍ថាមានសុវត្ថិភាព និងមានភាពកក់ក្តៅ។"
    },
    {
      icon: Icons.user(), category: "DAILY", title: "Small Love Every Day", khmerTitle: "ស្រឡាញ់រាល់ថ្ងៃ",
      short: "Love grows through small things done every day.", khmerShort: "ស្នេហាអាចចាប់ផ្តើមពីរឿងតូចៗដែលធ្វើជារៀងរាល់ថ្ងៃ។",
      quick: ["Ask how their day was", "Say thank you", "Help when they are tired"],
      khmerQuick: ["សួរគ្នាថ្ងៃនេះយ៉ាងម៉េច", "និយាយអរគុណ", "ជួយពេលម្នាក់ហត់"],
      detail: "Expensive gifts are not required. Consistent small care can mean more.",
      khmerDetail: "មិនចាំបាច់មានអំណោយថ្លៃៗទេ។ ការយកចិត្តទុកដាក់តូចៗដែលធ្វើជាប្រចាំ អាចមានន័យខ្លាំងជាង។"
    },
    {
      icon: Icons.family(), category: "DAILY", title: "Help Each Other", khmerTitle: "ជួយគ្នា",
      short: "Family responsibility belongs to both people.", khmerShort: "ការទទួលខុសត្រូវក្នុងគ្រួសារ គួរតែជារឿងរបស់មនុស្សពីរនាក់។",
      quick: ["Share housework", "Help when one is tired", "Do not keep score"],
      khmerQuick: ["ចែកការងារផ្ទះ", "ជួយពេលម្នាក់ហត់", "កុំរាប់ថាអ្នកណាធ្វើច្រើនជាង"],
      detail: "Balance is not always 50/50. Some days one person gives more, and other days the roles change.",
      khmerDetail: "Balance មិនមានន័យថា 50/50 រាល់ថ្ងៃទេ។ ថ្ងៃខ្លះម្នាក់អាចជួយបានច្រើនជាង ហើយថ្ងៃផ្សេងទៀតអាចប្តូរគ្នា។"
    },
    {
      icon: Icons.help(), category: "WEEKLY", title: "Our Time Together", khmerTitle: "ពេលវេលារបស់យើង",
      short: "Protect time for your relationship, not only responsibilities.", khmerShort: "កុំឱ្យការងារ និងបន្ទុកគ្រួសារធ្វើឱ្យភ្លេចភាពជាគូស្នេហ៍។",
      quick: ["Eat together", "Have coffee or watch a movie", "Take a small weekend trip"],
      khmerQuick: ["ញ៉ាំអាហារជាមួយគ្នា", "Coffee / Movie", "Weekend trip តូចៗ"],
      detail: "It does not need to cost much. What matters is choosing time to give each other.",
      khmerDetail: "មិនចាំបាច់ចំណាយលុយច្រើនទេ។ អ្វីសំខាន់គឺមានពេលដែលអ្នកទាំងពីរផ្តល់ឱ្យគ្នា។"
    },
    {
      icon: Icons.help(), category: "LOVE", title: "Talk to Each Other", khmerTitle: "និយាយគ្នា",
      short: "Small problems grow when they are left unspoken.", khmerShort: "បញ្ហាតូចៗអាចក្លាយជាបញ្ហាធំ បើមិននិយាយគ្នា។",
      quick: ["Listen before answering", "Say what is bothering you", "Solve it together"],
      khmerQuick: ["ស្តាប់មុនឆ្លើយ", "និយាយពីអ្វីដែលធ្វើឱ្យមិនសប្បាយ", "ដោះស្រាយជាមួយគ្នា"],
      detail: "Do not focus on winning an argument. Focus on solving the problem together. Try saying, \"We have a problem. How can we solve it together?\"",
      khmerDetail: "កុំផ្តោតលើការឈ្នះការឈ្លោះ។ ផ្តោតលើការដោះស្រាយបញ្ហា។ ជំនួសឱ្យពាក្យថា «អ្នកតែងតែ...» សាកនិយាយថា «យើងមានបញ្ហាមួយ។ តើយើងអាចដោះស្រាយជាមួយគ្នាយ៉ាងម៉េច?»"
    },
    {
      icon: Icons.money(), category: "MONEY", title: "Money and Home", khmerTitle: "លុយ និងផ្ទះ",
      short: "Manage money together to keep home life steady.", khmerShort: "គ្រប់គ្រងលុយជាមួយគ្នា ដើម្បីរក្សាផ្ទះឱ្យមានស្ថេរភាព។",
      quick: ["Know the monthly loan", "Plan monthly spending", "Avoid unnecessary debt"],
      khmerQuick: ["ដឹងចំនួន loan រាល់ខែ", "រៀបចំចំណាយប្រចាំខែ", "កុំបង្កើតបំណុលមិនចាំបាច់"],
      detail: "A home loan is a responsibility, but it supports the place where you live. Manage it without making daily life too stressful.",
      khmerDetail: "ប្រាក់កម្ចីផ្ទះគឺជាការទទួលខុសត្រូវ ប៉ុន្តែវាជាប្រាក់ដែលទៅលើកន្លែងរស់នៅរបស់យើង។ គោលដៅគឺគ្រប់គ្រងវាឱ្យបានល្អ ដោយមិនធ្វើឱ្យជីវិតប្រចាំថ្ងៃតានតឹងពេក។"
    },
    {
      icon: Icons.family(), category: "FAMILY", title: "Both Families", khmerTitle: "គ្រួសារទាំងសងខាង",
      short: "Respect the family that raised you and the family you are building.", khmerShort: "គោរពគ្រួសារដែលចិញ្ចឹមយើង និងគ្រួសារដែលយើងកំពុងបង្កើត។",
      quick: ["Respect parents", "Support your partner's family", "Make important decisions together"],
      khmerQuick: ["គោរពឪពុកម្តាយ", "គាំទ្រគ្រួសាររបស់ partner", "សម្រេចចិត្តសំខាន់ៗជាមួយគ្នា"],
      detail: "Marriage does not mean leaving an old family behind. A new family also needs care and protection.",
      khmerDetail: "ការរៀបការមិនមានន័យថាបោះបង់គ្រួសារចាស់ទេ។ ប៉ុន្តែគ្រួសារថ្មីក៏ត្រូវការការថែរក្សា និងការពារ។"
    },
    {
      icon: Icons.family(), category: "BALANCE", title: "Family Balance", khmerTitle: "Balance រវាងគ្រួសារ",
      short: "Balance does not mean everything must be 50/50.", khmerShort: "Balance មិនមែនមានន័យថាត្រូវស្មើគ្នា 50/50 រាល់ពេលទេ។",
      quick: ["Think about time", "Think about travel cost", "Adapt to the situation"],
      khmerQuick: ["គិតពីពេលវេលា", "គិតពីថ្លៃធ្វើដំណើរ", "សម្របតាមស្ថានភាព"],
      detail: "If visiting both sides in one day costs too much, split the visits across different days. The goal is respect without financial pressure.",
      khmerDetail: "បើមិនមានឡាន ហើយការទៅទាំងពីរខាងក្នុងថ្ងៃតែមួយចំណាយច្រើន អាចបែងថ្ងៃបាន។ គោលដៅគឺគោរពទាំងពីរខាង ដោយមិនបង្កើតសម្ពាធហិរញ្ញវត្ថុ។"
    },
    {
      icon: Icons.calendar(), category: "HOLIDAY", title: "Holidays", khmerTitle: "ថ្ងៃបុណ្យ",
      short: "Plan holidays together before visiting family.", khmerShort: "រៀបចំថ្ងៃបុណ្យជាមួយគ្នា មុនពេលទៅលេងគ្រួសារ។",
      quick: ["Plan the days early", "Think about travel", "Set a budget"],
      khmerQuick: ["រៀបចំថ្ងៃជាមុន", "គិតពីការធ្វើដំណើរ", "គិតពីថវិកា"],
      detail: "You can visit one family on one day and the other family on another day. It does not have to be perfectly equal.",
      khmerDetail: "អាចទៅគ្រួសារខាងមួយថ្ងៃ និងមួយខាងនៅថ្ងៃផ្សេង។ មិនចាំបាច់បង្ខំឱ្យស្មើគ្នាដាច់ខាតទេ។"
    },
    {
      icon: Icons.user(), category: "SELF", title: "Personal Time", khmerTitle: "ពេលវេលាផ្ទាល់ខ្លួន",
      short: "Living together still needs personal space.", khmerShort: "ការរស់នៅជាមួយគ្នា ក៏ត្រូវការពេលវេលាផ្ទាល់ខ្លួនដែរ។",
      quick: ["Keep a personal hobby", "See friends", "Make quiet time"],
      khmerQuick: ["មាន hobby ផ្ទាល់ខ្លួន", "ជួបមិត្តភក្តិ", "មានពេលស្ងប់ស្ងាត់"],
      detail: "Personal space does not mean less love. It can help both people feel comfortable and respected.",
      khmerDetail: "Personal space មិនមានន័យថាស្នេហាតិចទេ។ វាអាចជួយឱ្យមនុស្សពីរនាក់មានអារម្មណ៍ស្រួល និងគោរពគ្នា។"
    },
    {
      icon: Icons.family(), category: "FUTURE", title: "If You Have Children", khmerTitle: "បើមានកូន",
      short: "Do not let life become only work, children, money, and chores.", khmerShort: "កុំឱ្យជីវិតក្លាយជាការងារ + កូន + លុយ + ការងារផ្ទះប៉ុណ្ណោះ។",
      quick: ["Share childcare", "Help when one is tired", "Make time for each other"],
      khmerQuick: ["ចែកការងារថែទាំកូន", "ជួយគ្នាពេលហត់", "រកពេលសម្រាប់គ្នា"],
      detail: "Before becoming parents, you were partners. Keep caring for the relationship between you.",
      khmerDetail: "មុនពេលក្លាយជាឪពុកម្តាយ អ្នកទាំងពីរគឺជាគូស្នេហ៍។ កុំភ្លេចថែរក្សាទំនាក់ទំនងរបស់អ្នកទាំងពីរ។"
    },
    {
      icon: Icons.spark(), category: "MINDSET", title: "Social Media", khmerTitle: "Social Media",
      short: "Do not compare your life with what you see online.", khmerShort: "កុំយកជីវិតរបស់អ្នកទៅប្រៀបធៀបជាមួយអ្វីដែលឃើញ Online។",
      quick: ["Online is not the whole life", "Learn without assuming", "Do not predict your future from others"],
      khmerQuick: ["Social Media មិនមែនជាជីវិតទាំងមូល", "រៀនពីបញ្ហារបស់អ្នកដទៃ", "កុំសន្មត់ថារឿងដូចគ្នានឹងកើតលើយើង"],
      detail: "Social media often highlights conflict because it attracts attention. Quiet, healthy couples may simply post nothing.",
      khmerDetail: "Social Media ងាយបង្ហាញរឿង Divorce, Conflict និង Problems ព្រោះរឿងទាំងនេះទាក់ទាញការចាប់អារម្មណ៍។ គូស្នេហ៍ដែលរស់នៅធម្មតា និងសុខសាន្ត អាចមិន Post អ្វីទាំងអស់។"
    },
    {
      icon: Icons.user(), category: "LOVE", title: "When Your Partner Is Afraid", khmerTitle: "ពេល partner មានការភ័យ",
      short: "When love feels uncertain, show it through actions.", khmerShort: "បើ partner ខ្លាចថាស្នេហានឹងផ្លាស់ប្តូរ បង្ហាញតាមសកម្មភាព។",
      quick: ["Listen", "Help", "Spend time together"],
      khmerQuick: ["ស្តាប់", "ជួយ", "ចំណាយពេលជាមួយគ្នា"],
      detail: "Show love through help, listening, respect, keeping promises, and steady care, not words alone.",
      khmerDetail: "កុំត្រឹមតែនិយាយថា «ខ្ញុំស្រឡាញ់អ្នក»។ បង្ហាញតាមការជួយ ការស្តាប់ ការគោរព ការរក្សាពាក្យសន្យា និងការយកចិត្តទុកដាក់។"
    },
    {
      icon: Icons.home(), category: "FUTURE", title: "Build Life Together", khmerTitle: "សាងសង់ជីវិតជាមួយគ្នា",
      short: "You do not need a perfect life before building a family.", khmerShort: "មិនចាំបាច់មានជីវិត Perfect មុនពេលបង្កើតគ្រួសារទេ។",
      quick: ["Have a livable home", "Manage finances", "Learn to adapt"],
      khmerQuick: ["មានផ្ទះដែលអាចរស់នៅបាន", "គ្រប់គ្រងហិរញ្ញវត្ថុ", "រៀនសម្របគ្នា"],
      detail: "A family needs two people willing to listen, help, adapt, and build the future together.",
      khmerDetail: "គ្រួសារមិនត្រូវការជីវិត perfect ទេ។ វាត្រូវការមនុស្សពីរនាក់ដែលចង់ស្តាប់ ជួយគ្នា សម្របគ្នា និងសាងសង់អនាគតជាមួយគ្នា។"
    }
  ];
}

function renderTips() {
  const groups = getTipsData();
  const isKhmer = languageCode() === "km";
  const selectedLang = isKhmer ? "km" : "en";
  const principles = getFamilyPrinciples();
  const dayIndex = Math.floor(Date.now() / 86400000) % groups.length;
  const tipOfDay = groups[dayIndex];
  const title = isKhmer ? "គន្លឹះ" : t("tips");
  const subtitle = isKhmer ? "រឿងតូចៗដែលជួយឱ្យជីវិតគ្រួសាររបស់យើងមានភាពកក់ក្តៅ និងរឹងមាំ។" : t("familyTipsIntro");
  const supporting = isKhmer ? "មិនចាំបាច់ល្អឥតខ្ចោះទេ — សាងសង់ជីវិតជាមួយគ្នា មួយថ្ងៃម្តង។ ❤️" : "You do not need to be perfect. Build life together, one day at a time. ❤️";
  const categoryLabels = ["ALL", "DAILY", "WEEKLY", "LOVE", "FAMILY", "MONEY", "FUTURE"];
  const filterCategory = group => ({ BALANCE: "FAMILY", HOLIDAY: "FAMILY", SELF: "LOVE", MINDSET: "LOVE" }[group.category] || group.category);
  const tipImages = [
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1504159506876-f8338247a14a?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1504159506876-f8338247a14a?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=240&q=75",
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=240&q=75"
  ];
  const coupleImage = getTipsCoupleImage();
  const text = group => ({
    title: selectedLang === "km" ? group.khmerTitle : group.title,
    short: selectedLang === "km" ? group.khmerShort : group.short,
    quick: selectedLang === "km" ? group.khmerQuick : group.quick,
    detail: selectedLang === "km" ? group.khmerDetail : group.detail
  });

  return `
    <section class="page tips-page">
      <div class="page-header tips-page-header">
        <div>
          <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${Icons.help()}</span>${title}</h1>
          <p class="page-subtitle">${escapeHtml(subtitle)}</p>
          <p class="tips-supporting-line">${escapeHtml(supporting)}</p>
        </div>
      </div>

      <article class="glass-card tips-day-card">
        <div class="tips-day-icon">${Icons.spark()}</div>
        <div class="tips-day-copy">
          <span class="tips-eyebrow">${isKhmer ? "គន្លឹះប្រចាំថ្ងៃ" : "TIP OF THE DAY"}</span>
          <strong>${escapeHtml(text(tipOfDay).short)}</strong>
        </div>
        <button class="button ghost-button tips-day-button" type="button" data-tip-focus="${dayIndex}">${isKhmer ? "មើលគន្លឹះ" : "View tip"} ${Icons.chevron()}</button>
        <div class="tips-couple-photo-area">
          ${coupleImage ? `<img class="tips-couple-photo" src="${escapeAttr(coupleImage)}" alt="${isKhmer ? "រូបថតគូស្នេហ៍" : "Couple photo"}">` : `<span class="tips-couple-photo-empty">${Icons.family()}</span>`}
          <label class="tips-photo-upload">${coupleImage ? (isKhmer ? "ប្តូររូប" : "Change photo") : (isKhmer ? "បន្ថែមរូបគូស្នេហ៍" : "Add couple photo")}<input type="file" accept="image/*" data-couple-photo></label>
        </div>
      </article>

      <div class="tips-filter-row" role="toolbar" aria-label="${isKhmer ? "ច្រោះគន្លឹះ" : "Tip filters"}">
        ${categoryLabels.map((category, index) => `<button class="tips-filter ${index === 0 ? "active" : ""}" type="button" data-tip-filter="${category}">${category}</button>`).join("")}
      </div>

      <div class="tips-page-shell tips-card-grid">
        ${groups.map((group, index) => {
          const current = text(group);
          return `
            <details class="glass-card tips-compact-card" data-tip-card data-category="${filterCategory(group)}" data-tip-index="${index}">
              <summary>
                <span class="tips-compact-head">
                  <span class="tips-group-icon">${group.icon}</span>
                  <span class="tips-compact-meta"><span class="tips-eyebrow">${group.category}</span><strong>${escapeHtml(current.title)}</strong></span>
                </span>
                <img class="tips-compact-image" src="${tipImages[index]}" alt="" loading="lazy">
                <span class="tips-compact-chevron">${Icons.chevron()}</span>
              </summary>
              <div class="tips-compact-body">
                <p class="tips-short-description">${escapeHtml(current.short)}</p>
                <ul class="tips-quick-list">${current.quick.map(item => `<li><span>${Icons.check()}</span>${escapeHtml(item)}</li>`).join("")}</ul>
                <div class="tips-detail-copy"><strong>${isKhmer ? "លម្អិត" : "More"}</strong><p>${escapeHtml(current.detail)}</p></div>
                <button class="button ghost-button tips-close-detail" type="button">${isKhmer ? "បិទ" : "Close"}</button>
              </div>
              <span class="tips-more-label">${isKhmer ? "មើលបន្ថែម" : "View more"} ${Icons.chevron()}</span>
            </details>
          `;
        }).join("")}
      </div>

      <article class="glass-card tips-principles-card">
        <div class="tips-principles-header">
          <div><span class="tips-eyebrow">${isKhmer ? "គ្រួសាររបស់យើង" : "OUR FAMILY PRINCIPLES"}</span><h2>${isKhmer ? "គោលការណ៍របស់យើង" : "Our family principles"}</h2></div>
          <button class="icon-button" type="button" data-principles-edit aria-label="${isKhmer ? "កែប្រែ" : "Edit"}" title="${isKhmer ? "កែប្រែ" : "Edit"}">${Icons.edit()}</button>
        </div>
        <ul class="tips-principles-list">${principles.map(item => `<li><span>${Icons.check()}</span>${escapeHtml(item)}</li>`).join("")}</ul>
        <form class="tips-principles-form" data-principles-form hidden>
          <label for="principlesInput">${isKhmer ? "គោលការណ៍មួយក្នុងមួយបន្ទាត់" : "One principle per line"}</label>
          <textarea id="principlesInput" rows="6">${escapeHtml(principles.join("\n"))}</textarea>
          <div class="action-row"><button class="button" type="submit">${isKhmer ? "រក្សាទុក" : "Save"}</button><button class="button ghost-button" type="button" data-principles-cancel>${isKhmer ? "បោះបង់" : "Cancel"}</button></div>
        </form>
      </article>

      <p class="tips-final-note">${isKhmer ? "គ្រួសារដែលល្អ មិនមែនជាគ្រួសារដែលគ្មានបញ្ហាទេ។ វាគឺជាគ្រួសារដែលចេះស្តាប់ ជួយគ្នា សម្របគ្នា និងដោះស្រាយបញ្ហាជាមួយគ្នា។ ❤️" : "A good family is not a family without problems. It is a family that listens, helps, adapts, and solves problems together. ❤️"}</p>
    </section>
  `;
}

function getFamilyPrinciples() {
  const defaults = ["ជួយគ្នា", "និយាយគ្នា", "គោរពគ្រួសារទាំងសងខាង", "គ្រប់គ្រងលុយជាមួយគ្នា", "រកពេលសម្រាប់គ្នា", "សម្របគ្នាពេលមានបញ្ហា"];
  try {
    const saved = JSON.parse(localStorage.getItem("mylife:family-principles") || "null");
    return Array.isArray(saved) && saved.length ? saved : defaults;
  } catch (error) {
    return defaults;
  }
}

function getTipsCoupleImage() {
  try {
    return localStorage.getItem("mylife:tips-couple-image") || "";
  } catch (error) {
    return "";
  }
}

function bindTips() {
  document.querySelectorAll("[data-tip-filter]").forEach(button => button.addEventListener("click", () => {
    const category = button.dataset.tipFilter;
    document.querySelectorAll("[data-tip-filter]").forEach(item => item.classList.toggle("active", item === button));
    document.querySelectorAll("[data-tip-card]").forEach(card => {
      card.hidden = category !== "ALL" && card.dataset.category !== category;
      if (card.hidden) card.open = false;
    });
  }));

  document.querySelectorAll(".tips-close-detail").forEach(button => button.addEventListener("click", event => {
    event.preventDefault();
    button.closest("details").open = false;
  }));

  document.querySelector("[data-tip-focus]")?.addEventListener("click", event => {
    const card = document.querySelector(`[data-tip-index="${event.currentTarget.dataset.tipFocus}"]`);
    if (!card) return;
    card.open = true;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  document.querySelector("[data-couple-photo]")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      localStorage.setItem("mylife:tips-couple-image", await readImageFile(file));
      App.render();
    } catch (error) {
      Toast.show(languageCode() === "km" ? "មិនអាចបញ្ចូលរូបភាពបានទេ" : "The image could not be uploaded.");
    }
  });

  const principlesForm = document.querySelector("[data-principles-form]");
  const principlesCard = document.querySelector(".tips-principles-card");
  document.querySelector("[data-principles-edit]")?.addEventListener("click", () => {
    principlesForm.hidden = false;
    principlesCard.querySelector(".tips-principles-list").hidden = true;
    principlesForm.querySelector("textarea").focus();
  });
  document.querySelector("[data-principles-cancel]")?.addEventListener("click", () => {
    principlesForm.hidden = true;
    principlesCard.querySelector(".tips-principles-list").hidden = false;
  });
  principlesForm?.addEventListener("submit", event => {
    event.preventDefault();
    const principles = principlesForm.querySelector("textarea").value.split("\n").map(item => item.trim()).filter(Boolean).slice(0, 10);
    localStorage.setItem("mylife:family-principles", JSON.stringify(principles));
    App.render();
  });
}

function renderLegacyTips() {
  const groups = [
    {
      icon: Icons.home(),
      title: "Our Home",
      khmerTitle: "ផ្ទះរបស់យើង",
      items: [
        { enTitle: "Home is a safe place", kmTitle: "ផ្ទះគឺជាកន្លែងសម្រាប់សុវត្ថិភាព", enText: "A home is not only a building. It is a place where both partners feel safe, comfortable, respected, and supported.", kmText: "ផ្ទះមិនត្រឹមតែជាអគារទេ។ វាគឺជាកន្លែងដែលដៃគូទាំងពីររីករាយ សុវត្ថិភាព គោរព និងត្រូវបានគាំទ្រ។" },
        { enTitle: "Home habits", kmTitle: "ទម្លាប់ក្នុងផ្ទះ", enText: "Keep the home clean together, share responsibilities, make it comfortable, and make important decisions together.", kmText: "សម្អាតផ្ទះជាមួយគ្នា ចែករំលែកកិច្ចការទាន់ពេលវេលា និងធ្វើការសម្រេចចិត្តសំខាន់ជាមួយគ្នា។" }
      ]
    },
    {
      icon: Icons.user(),
      title: "Small Love Every Day",
      khmerTitle: "សេចក្តីស្រឡាញ់តូចៗរាល់ថ្ងៃ",
      items: [
        { enTitle: "Daily care matters", kmTitle: "ការថែទាំប្រចាំថ្ងៃមានค่า", enText: "Ask how the day was, say thank you, give a hug, help when tired, eat together, listen, and remember the little things that matter.", kmText: "សួរថាថ្ងៃនេះរបៀបណា សូមសរសើរ ឱបគ្នា ជួយពេលមានកម្លាំងតិច និយាយគ្នា និងចងចាំអ្វីដែលមានន័យ។" },
        { enTitle: "Small care is meaningful", kmTitle: "ការថែទាំតូចៗមានន័យ", enText: "Small care every day can be more meaningful than expensive gifts.", kmText: "ការថែទាំតូចៗរាល់ថ្ងៃអាចមានន័យច្រើនជាងការជូនរង្វាន់ដែលមានតម្លៃខ្ពស់។" }
      ]
    },
    {
      icon: Icons.family(),
      title: "Help Each Other",
      khmerTitle: "ជួយគ្នា",
      items: [
        { enTitle: "Shared responsibility", kmTitle: "ការទទួលខុសត្រូវរួម", enText: "Family responsibility should not belong to only one person. Help with housework, share cooking and cleaning, and appreciate what each person does.", kmText: "កិច្ចការក្នុងគ្រួសារមិនគួរតែត្រូវទទួលខុសត្រូវដោយម្នាក់ម្នាក់ទេ។ ជួយគ្នាក្នុងផ្ទះ ចែករំលែកការចម្អិន និងសម្អាត និងកោតសរសើរ។" },
        { enTitle: "No scorekeeping", kmTitle: "មិនត្រូវដាក់ពិន្ទុ", enText: "Do not keep score of who did more. Sometimes one person gives more and sometimes the other does. The goal is to support each other.", kmText: "កុំដាក់ពិន្ទុថាត្រូវបានលើកទឹកចិត្តកាន់តែច្រើន។ គោលដៅគឺជួយគ្នា និងគាំទ្រ។" }
      ]
    },
    {
      icon: Icons.help(),
      title: "Keep Our Relationship",
      khmerTitle: "រក្សាទំនាក់ទំនងរបស់យើង",
      items: [
        { enTitle: "Quality time", kmTitle: "ពេលវេលាដែលមានគុណភាព", enText: "Make time for each other through dinner together, movies, coffee, short trips, walks, and relaxing at home.", kmText: "រកពេលជាមួយគ្នា តាមរយៈអាហារពេលល្ងាច ខ្សែភាពយន្ត កាហ្វេ ធ្វើដំណើរ និងសម្រាកនៅផ្ទះ។" },
        { enTitle: "It does not need to be expensive", kmTitle: "មិនចាំបាច់មានតម្លៃខ្ពស់", enText: "Quality time matters more than money.", kmText: "ពេលវេលាដែលមានគុណភាពមានតម្លៃជាងប្រាក់។" }
      ]
    },
    {
      icon: Icons.help(),
      title: "Communication",
      khmerTitle: "ការនិយាយគ្នា",
      items: [
        { enTitle: "Talk early", kmTitle: "និយាយនៅពេលដំបូង", enText: "Talk when something is bothering you, ask if your partner needs help, and listen before judging.", kmText: "និយាយនៅពេលមានអារម្មណ៍មិនស្រួល សួរថាដៃគូនៅត្រូវការជួយដោយរបៀបណា និងស្តាប់មុនពេលវាយតម្លៃ។" },
        { enTitle: "Solve together", kmTitle: "ដោះស្រាយជាមួយគ្នា", enText: "Discuss problems instead of avoiding them, and focus on solving the issue, not winning the argument.", kmText: "ពិភាក្សាលើបញ្ហា ជំនួសឱ្យចៀសវាង ហើយផ្តោតលើការដោះស្រាយជាមួយគ្នា។" }
      ]
    },
    {
      icon: Icons.money(),
      title: "Money & House Loan",
      khmerTitle: "ហិរញ្ញវត្ថុ និងប្រាក់កម្ចីផ្ទះ",
      items: [
        { enTitle: "Plan responsibly", kmTitle: "គ្រោងការណ៍ដោយទំនួលខុសត្រូវ", enText: "Know the monthly payment, plan household expenses, save an emergency fund, avoid unnecessary debt, and discuss large expenses together.", kmText: "ដឹងពីការបង់ប្រាក់ប្រចាំខែ គ្រោងថវិកាក្នុងផ្ទះ ទុកប្រាក់បន្ទាន់បំផុត និងពិភាក្សាអំពីការចំណាយធំជាមួយគ្នា។" },
        { enTitle: "Respect the goal", kmTitle: "គោរពចំពោះគោលដៅ", enText: "The goal is not a perfect financial situation. The goal is to manage money together responsibly.", kmText: "គោលដៅមិនមែនជាស្ថានភាពហិរញ្ញវត្ថុដ៏ល្អឥតខ្ចោះទេទេ។ គោលដៅគឺគ្រប់គ្រងប្រាក់ដោយទំនួលខុសត្រូវ និងរួមគ្នា។" }
      ]
    }
  ];

  const isKhmer = languageCode() === "km";
  const selectedLang = isKhmer ? "km" : "en";

  return `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title page-title-with-icon"><span class="page-title-icon">${Icons.help()}</span>${t("tips")}</h1>
          <p class="page-subtitle">${t("familyTipsIntro")}</p>
        </div>
      </div>

      <div class="tips-page-shell">
        ${groups.map(group => `
          <article class="glass-card tips-group-card">
            <div class="tips-group-head">
              <span class="tips-group-icon">${group.icon}</span>
              <div>
                <h2>${escapeHtml(isKhmer ? group.khmerTitle : group.title)}</h2>
                ${isKhmer ? "" : `<small>${escapeHtml(group.khmerTitle)}</small>`}
              </div>
            </div>
            <div class="tips-language-grid">
              <div class="tips-language-block ${isKhmer ? "khmer-block" : ""}">
                ${group.items.map(item => `
                  <div class="tips-item-block">
                    <strong>${escapeHtml(selectedLang === "en" ? item.enTitle : item.kmTitle)}</strong>
                    <p>${escapeHtml(selectedLang === "en" ? item.enText : item.kmText)}</p>
                  </div>
                `).join("")}
              </div>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function openTipsModal() {
  const groups = [
    {
      icon: Icons.home(),
      title: "Our Home",
      khmerTitle: "ផ្ទះរបស់យើង",
      items: [
        { enTitle: "Home is a safe place", kmTitle: "ផ្ទះគឺជាកន្លែងសម្រាប់សុវត្ថិភាព", enText: "A home is not only a building. It is a place where both partners feel safe, comfortable, respected, and supported.", kmText: "ផ្ទះមិនត្រឹមតែជាអគារទេ។ វាគឺជាកន្លែងដែលដៃគូទាំងពីររីករាយ សុវត្ថិភាព គោរព និងត្រូវបានគាំទ្រ។" },
        { enTitle: "Home habits", kmTitle: "ទម្លាប់ក្នុងផ្ទះ", enText: "Keep the home clean together, share responsibilities, make it comfortable, and make important decisions together.", kmText: "សម្អាតផ្ទះជាមួយគ្នា ចែករំលែកកិច្ចការទាន់ពេលវេលា និងធ្វើការសម្រេចចិត្តសំខាន់ជាមួយគ្នា។" }
      ]
    },
    {
      icon: Icons.user(),
      title: "Small Love Every Day",
      khmerTitle: "សេចក្តីស្រឡាញ់តូចៗរាល់ថ្ងៃ",
      items: [
        { enTitle: "Daily care matters", kmTitle: "ការថែទាំប្រចាំថ្ងៃមានค่า", enText: "Ask how the day was, say thank you, give a hug, help when tired, eat together, listen, and remember the little things that matter.", kmText: "សួរថាថ្ងៃនេះរបៀបណា សូមសរសើរ ឱបគ្នា ជួយពេលមានកម្លាំងតិច និយាយគ្នា និងចងចាំអ្វីដែលមានន័យ។" },
        { enTitle: "Small care is meaningful", kmTitle: "ការថែទាំតូចៗមានន័យ", enText: "Small care every day can be more meaningful than expensive gifts.", kmText: "ការថែទាំតូចៗរាល់ថ្ងៃអាចមានន័យច្រើនជាងការជូនរង្វាន់ដែលមានតម្លៃខ្ពស់។" }
      ]
    },
    {
      icon: Icons.family(),
      title: "Help Each Other",
      khmerTitle: "ជួយគ្នា",
      items: [
        { enTitle: "Shared responsibility", kmTitle: "ការទទួលខុសត្រូវរួម", enText: "Family responsibility should not belong to only one person. Help with housework, share cooking and cleaning, and appreciate what each person does.", kmText: "កិច្ចការក្នុងគ្រួសារមិនគួរតែត្រូវទទួលខុសត្រូវដោយម្នាក់ម្នាក់ទេ។ ជួយគ្នាក្នុងផ្ទះ ចែករំលែកការចម្អិន និងសម្អាត និងកោតសរសើរ។" },
        { enTitle: "No scorekeeping", kmTitle: "មិនត្រូវដាក់ពិន្ទុ", enText: "Do not keep score of who did more. Sometimes one person gives more and sometimes the other does. The goal is to support each other.", kmText: "កុំដាក់ពិន្ទុថាត្រូវបានលើកទឹកចិត្តកាន់តែច្រើន។ គោលដៅគឺជួយគ្នា និងគាំទ្រ។" }
      ]
    },
    {
      icon: Icons.help(),
      title: "Keep Our Relationship",
      khmerTitle: "រក្សាទំនាក់ទំនងរបស់យើង",
      items: [
        { enTitle: "Quality time", kmTitle: "ពេលវេលាដែលមានគុណភាព", enText: "Make time for each other through dinner together, movies, coffee, short trips, walks, and relaxing at home.", kmText: "រកពេលជាមួយគ្នា តាមរយៈអាហារពេលល្ងាច ខ្សែភាពយន្ត កាហ្វេ ធ្វើដំណើរ និងសម្រាកនៅផ្ទះ។" },
        { enTitle: "It does not need to be expensive", kmTitle: "មិនចាំបាច់មានតម្លៃខ្ពស់", enText: "Quality time matters more than money.", kmText: "ពេលវេលាដែលមានគុណភាពមានតម្លៃជាងប្រាក់។" }
      ]
    },
    {
      icon: Icons.help(),
      title: "Communication",
      khmerTitle: "ការនិយាយគ្នា",
      items: [
        { enTitle: "Talk early", kmTitle: "និយាយនៅពេលដំបូង", enText: "Talk when something is bothering you, ask if your partner needs help, and listen before judging.", kmText: "និយាយនៅពេលមានអារម្មណ៍មិនស្រួល សួរថាដៃគូនៅត្រូវការជួយដោយរបៀបណា និងស្តាប់មុនពេលវាយតម្លៃ។" },
        { enTitle: "Solve together", kmTitle: "ដោះស្រាយជាមួយគ្នា", enText: "Discuss problems instead of avoiding them, and focus on solving the issue, not winning the argument.", kmText: "ពិភាក្សាលើបញ្ហា ជំនួសឱ្យចៀសវាង ហើយផ្តោតលើការដោះស្រាយជាមួយគ្នា។" }
      ]
    },
    {
      icon: Icons.money(),
      title: "Money & House Loan",
      khmerTitle: "ហិរញ្ញវត្ថុ និងប្រាក់កម្ចីផ្ទះ",
      items: [
        { enTitle: "Plan responsibly", kmTitle: "គ្រោងការណ៍ដោយទំនួលខុសត្រូវ", enText: "Know the monthly payment, plan household expenses, save an emergency fund, avoid unnecessary debt, and discuss large expenses together.", kmText: "ដឹងពីការបង់ប្រាក់ប្រចាំខែ គ្រោងថវិកាក្នុងផ្ទះ ទុកប្រាក់បន្ទាន់បំផុត និងពិភាក្សាអំពីការចំណាយធំជាមួយគ្នា។" },
        { enTitle: "Respect the goal", kmTitle: "គោរពចំពោះគោលដៅ", enText: "The goal is not a perfect financial situation. The goal is to manage money together responsibly.", kmText: "គោលដៅមិនមែនជាស្ថានភាពហិរញ្ញវត្ថុដ៏ល្អឥតខ្ចោះទេទេ។ គោលដៅគឺគ្រប់គ្រងប្រាក់ដោយទំនួលខុសត្រូវ និងរួមគ្នា។" }
      ]
    }
  ];

  const isKhmer = languageCode() === "km";
  const selectedLang = isKhmer ? "km" : "en";
  const selectedLabel = isKhmer ? "Khmer" : "English";
  const selectedBadge = isKhmer ? "KH" : "EN";

  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="modal glass-card modal-wide tips-modal" aria-modal="true" role="dialog" aria-labelledby="tipsTitle">
      <div class="tips-modal-header">
        <div class="tips-modal-title-wrap">
          <span class="tips-modal-badge">${Icons.help()}</span>
          <div>
            <h2 id="tipsTitle">${isKhmer ? "គន្លឹះជីវិតគ្រួសារ" : "Family Life Tips"}</h2>
            <p class="secondary tips-modal-subtitle">${isKhmer ? "Family Life Tips" : "គន្លឹះជីវិតគ្រួសារ"}</p>
          </div>
        </div>
        <button class="icon-button" type="button" data-close aria-label="Close">${Icons.close()}</button>
      </div>

      <div class="tips-accordion">
        ${groups.map((group, index) => `
          <div class="tips-group ${index === 0 ? "active" : ""}">
            <button class="tips-group-toggle" type="button" aria-expanded="${index === 0 ? "true" : "false"}">
              <span class="tips-group-icon">${group.icon}</span>
              <span class="tips-group-copy">
                <strong>${escapeHtml(group.title)}</strong>
                <small>${escapeHtml(group.khmerTitle)}</small>
              </span>
              <span class="tips-chevron">${Icons.chevron()}</span>
            </button>
            <div class="tips-group-panel" ${index === 0 ? "style=\"display:block\"" : ""}>
              <div class="tips-language-grid">
                <div class="tips-language-block ${isKhmer ? "khmer-block" : ""}">
                  <div class="tips-language-label"><span>${selectedBadge}</span> ${selectedLabel}</div>
                  ${group.items.map(item => `
                    <div class="tips-item-block">
                      <strong>${escapeHtml(selectedLang === "en" ? item.enTitle : item.kmTitle)}</strong>
                      <p>${escapeHtml(selectedLang === "en" ? item.enText : item.kmText)}</p>
                    </div>
                  `).join("")}
                </div>
              </div>
            </div>
          </div>
        `).join("")}
      </div>

      <div class="between tips-modal-actions">
        <button class="button ghost-button" type="button" data-close>Close</button>
      </div>
    </div>
  `;
  root.classList.add("open");

  root.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => {
    root.classList.remove("open");
    root.innerHTML = "";
  }));

  root.querySelectorAll(".tips-group-toggle").forEach(button => {
    button.addEventListener("click", () => {
      const group = button.closest(".tips-group");
      const panel = group.querySelector(".tips-group-panel");
      const isOpen = group.classList.contains("active");
      root.querySelectorAll(".tips-group").forEach(item => {
        item.classList.remove("active");
        item.querySelector(".tips-group-toggle").setAttribute("aria-expanded", "false");
        item.querySelector(".tips-group-panel").style.display = "none";
      });
      if (!isOpen) {
        group.classList.add("active");
        button.setAttribute("aria-expanded", "true");
        panel.style.display = "block";
      }
    });
  });
}

function bindHome() {
  document.querySelector("[data-family-photo]")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      localStorage.setItem("mylife:family-photo", await readImageFile(file));
      App.render();
    } catch (error) {
      Toast.show(languageCode() === "km" ? "មិនអាចបញ្ចូលរូបថតបានទេ" : "The photo could not be uploaded.");
    }
  });
  document.querySelectorAll('[data-action="add-event"]').forEach(button => button.addEventListener("click", () => App.openEventModal()));
  document.querySelectorAll('[data-action="smart-assistant"]').forEach(button => button.addEventListener("click", () => SmartAssistant.open()));
  document.querySelectorAll('[data-action="create-user"]').forEach(button => button.addEventListener("click", () => openCreateUserModal()));
  document.querySelectorAll('[data-action="add-goal"]').forEach(button => button.addEventListener("click", () => openGoalModal()));
  document.querySelectorAll('[data-action="setup-profile"]').forEach(button => {
    button.addEventListener("click", () => openProfileModal());
    button.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openProfileModal();
      }
    });
  });
}
