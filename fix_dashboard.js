const fs = require('fs');

const renderHome = `function renderHome() {
  const stats = Store.calculate();
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayEvents = appData.calendarEvents.filter(event => event.date === todayIso);
  const hasMoneyData = ["income", "expenses", "savings", "loans", "bills"].some(key => appData[key].length);
  const hasAnyData = appData.profile.name || ["family", "goals", "income", "expenses", "savings", "loans", "bills", "calendarEvents", "memories"].some(key => appData[key].length);
  const profileName = appData.profile.name || "Your Name";
  const firstName = profileName.split(/\\s+/).filter(Boolean)[0] || "there";
  const profilePosition = imagePosition(appData.profile.photoPosition);
  const profilePhoto = appData.profile.photo ? '<img src="' + appData.profile.photo + '" style="--image-position-x: ' + profilePosition.x + '%; --image-position-y: ' + profilePosition.y + '%;" alt="' + escapeHtml(profileName) + '">' : initials(profileName);
  const moodOptions = [
    { value: "happy", emoji: "😊", label: t("moodHappy"), robot: t("moodCheerful") },
    { value: "calm", emoji: "😌", label: t("moodCalm"), robot: t("moodBalanced") },
    { value: "tired", emoji: "😴", label: t("moodTired"), robot: t("moodLowEnergy") },
    { value: "stressed", emoji: "😟", label: t("moodStressed"), robot: t("moodNeedsEase") },
    { value: "excited", emoji: "🤩", label: t("moodExcited"), robot: t("moodMotivated") }
  ];
  const moodHistory = Array.isArray(appData.moodHistory) ? appData.moodHistory : [];
  const todayMood = appData.mood?.date === todayIso ? appData.mood : null;
  const selectedMood = todayMood ? moodOptions.find(option => option.value === todayMood.value) || moodOptions[0] : null;
  const reflectionText = appData.dailyReflection?.date === todayIso ? (appData.dailyReflection.text || "") : "";
  const focusDefaults = [
    { id: "focus-move", text: t("moveMyBody"), done: false },
    { id: "focus-water", text: t("drinkWater"), done: false },
    { id: "focus-family", text: t("checkInWithFamily"), done: false }
  ];
  const focusItems = appData.dailyFocus?.date === todayIso && Array.isArray(appData.dailyFocus.items) && appData.dailyFocus.items.length
    ? appData.dailyFocus.items
    : focusDefaults;
  const focusDoneCount = focusItems.filter(item => item.done).length;
  const focusProgress = focusItems.length ? Math.round((focusDoneCount / focusItems.length) * 100) : 0;
  const reflectionReady = (reflectionText || "").trim().length > 0;
  const upcomingAlerts = getUpcomingNotifications(14);
  const nextAlert = upcomingAlerts[0] || null;

  const newsTickerItems = upcomingAlerts.length
    ? upcomingAlerts.slice(0, 8).map(item => {
        const days = item.daysLeft;
        const when = days === 0 ? t("today") : days === 1 ? t("tomorrow") : t("inDays", { count: item.daysLeft });
        const typeIcon = item.kind === "bill" ? "💰" : item.type === "family-birthday" ? "🎂" : item.type === "family-anniversary" ? "💍" : item.kind === "reminder" ? "🔔" : "📅";
        const categoryLabel = item.source === "family" ? t("family") + " · " : item.kind === "bill" ? t("bill") + " · " : item.kind === "reminder" ? t("reminder") + " · " : "";
        return typeIcon + " " + categoryLabel + escapeHtml(item.title) + " — " + when;
      })
    : [t("noUpcomingEvents")];

  const moodHistoryChart = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const iso = date.toISOString().slice(0, 10);
    const entry = moodHistory.find(item => item.date === iso);
    const option = entry ? moodOptions.find(item => item.value === entry.value) : null;
    return {
      day: date.toLocaleDateString(languageCode() === "km" ? "km-KH" : "en-US", { weekday: "short" }).slice(0, 3),
      label: option ? option.label : "—",
      emoji: option ? option.emoji : "·",
      value: option ? option.value : ""
    };
  });

  return '<section class="page home-featured-page">' +
    '<div class="home-hero-panel">' +
      '<div class="home-hero-copy">' +
        '<span class="eyebrow">' + t("privateDashboard") + '</span>' +
        '<h1 class="page-title">' + t("goodMorning") + ', ' + escapeHtml(firstName) + '</h1>' +
        '<div class="home-quote-row">' +
          '<span class="quote-mark">“</span>' +
          '<p>' + t("smallStepsBigWins") + '</p>' +
          '<span class="quote-arrow">›</span>' +
        '</div>' +
      '</div>' +
      '<div class="home-profile-side home-profile-trigger" role="button" tabindex="0" aria-label="' + t("editProfile") + '">' +
        '<div class="home-avatar-ring">' +
          '<span class="home-user-avatar">' + profilePhoto + '</span>' +
        '</div>' +
        '<div class="home-profile-meta">' +
          '<strong>' + escapeHtml(profileName) + '</strong>' +
        '</div>' +
        '<div class="home-profile-menu" aria-hidden="true">' +
          '<button type="button" class="home-profile-menu-item" data-account-action="edit-profile">Edit profile</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    (typeof familyMediaCard === "function" ? familyMediaCard() : "") +
    '<div class="home-suggestion-banner">' +
      '<span class="suggestion-badge">' + Icons.spark() + '</span>' +
      '<div class="suggestion-copy">' +
        '<strong>' + (languageCode() === "km" ? "ត្រូវការជំនួយបន្តិច?" : "Need a nudge?") + '</strong>' +
        '<span>' + (languageCode() === "km" ? "កត់សម្គាល់អារម្មណ៍ ឬសរសេររឿងល្អមួយយ៉ាង" : "Check in, reflect, and finish a tiny win.") + '</span>' +
      '</div>' +
      '<button class="suggestion-button" type="button" data-action="smart-assistant">' + (languageCode() === "km" ? "ជំនួយ" : "Help") + '</button>' +
    '</div>' +
    '<div class="news-ticker" aria-label="News ticker">' +
      '<div class="news-ticker-track">' +
        [...newsTickerItems, ...newsTickerItems].map(item => '<span class="ticker-item">' + item + '</span>').join('<span class="ticker-divider">•</span>') +
      '</div>' +
    '</div>' +
    '<div class="home-quick-actions">' +
      '<button class="home-action action-green" type="button" data-action="smart-assistant">' +
        '<span class="action-icon">' + Icons.spark() + '</span>' +
        '<span class="action-content">' +
          '<strong>' + t("smartAssistant") + '</strong>' +
          '<small>' + t("instantHelpPrompt") + '</small>' +
        '</span>' +
        '<span class="action-arrow">›</span>' +
      '</button>' +
      '<button class="home-action action-purple" type="button" data-action="create-user">' +
        '<span class="action-icon">' + Icons.user() + '</span>' +
        '<span class="action-content">' +
          '<strong>' + t("createUser") + '</strong>' +
          '<small>' + t("manageProfilesPrompt") + '</small>' +
        '</span>' +
        '<span class="action-arrow">›</span>' +
      '</button>' +
      '<button class="home-action action-dark" type="button" data-action="add-goal">' +
        '<span class="action-icon">' + Icons.goal() + '</span>' +
        '<span class="action-content">' +
          '<strong>' + t("createGoal") + '</strong>' +
          '<small>' + t("goalPrompt") + '</small>' +
        '</span>' +
        '<span class="action-arrow">›</span>' +
      '</button>' +
      '<button class="home-action action-blue" type="button" data-action="add-event">' +
        '<span class="action-icon">' + Icons.calendar() + '</span>' +
        '<span class="action-content">' +
          '<strong>' + t("addEvent") + '</strong>' +
          '<small>' + t("eventPrompt") + '</small>' +
        '</span>' +
        '<span class="action-arrow">›</span>' +
      '</button>' +
    '</div>' +
    '<div class="home-overview">' +
      '<article class="glass-card mood-card">' +
        '<span class="eyebrow">' + t("mood") + '</span>' +
        '<h2 class="section-title section-title-with-icon"><span class="section-title-icon">' + Icons.mood() + '</span>' + t("mood") + '</h2>' +
        '<div class="mood-selector">' +
          moodOptions.map(option => '<button class="mood-button ' + (selectedMood && selectedMood.value === option.value ? "active" : "") + '" type="button" data-mood="' + option.value + '" aria-label="' + escapeHtml(option.label) + '"><span class="mood-emoji">' + option.emoji + '</span><span class="mood-label">' + escapeHtml(option.label) + '</span></button>').join("") +
        '</div>' +
        '<div class="mood-history">' +
          moodHistoryChart.map(day => '<div class="mood-history-day ' + (day.value === selectedMood?.value ? "active" : "") + '"><span class="mood-day">' + day.day + '</span><span class="mood-emoji">' + day.emoji + '</span></div>').join("") +
        '</div>' +
        (todayMood ? '<div class="mood-selected"><span class="eyebrow">' + t("todayMood") + '</span><span class="mood-emoji-large">' + selectedMood.emoji + '</span><strong>' + escapeHtml(selectedMood.label) + '</strong></div>' : '<p class="secondary" style="margin-top:12px;text-align:center">' + t("tapToLogMood") + '</p>') +
      '</article>' +
      '<article class="glass-card reflection-card">' +
        '<span class="eyebrow">' + t("dailyReflection") + '</span>' +
        '<h2 class="section-title section-title-with-icon"><span class="section-title-icon">' + Icons.quote() + '</span>' + t("dailyReflection") + '</h2>' +
        '<textarea class="reflection-textarea" placeholder="' + t("reflectionPlaceholder") + '" data-reflection-textarea>' + escapeHtml(reflectionText) + '</textarea>' +
        '<div class="reflection-stats">' +
          '<span class="stat"><strong>' + reflectionText.trim().length + '</strong> ' + t("characters") + '</span>' +
          '<span class="stat"><strong>' + reflectionText.trim().split(/\\s+/).filter(Boolean).length + '</strong> ' + t("words") + '</span>' +
        '</div>' +
        (reflectionReady ? '<button class="button" type="button" data-action="save-reflection">' + t("saveReflection") + '</button>' : '') +
      '</article>' +
      '<article class="glass-card focus-card">' +
        '<span class="eyebrow">' + t("dailyFocus") + '</span>' +
        '<h2 class="section-title section-title-with-icon"><span class="section-title-icon">' + Icons.target() + '</span>' + t("dailyFocus") + '</h2>' +
        '<div class="focus-progress"><div class="progress-track"><div class="progress-fill" style="--progress:' + focusProgress + '%"></div></div><span class="focus-progress-text">' + focusProgress + '%</span></div>' +
        '<ul class="focus-list">' +
          focusItems.map(item => '<li class="focus-item ' + (item.done ? "done" : "") + '"><label><input type="checkbox" ' + (item.done ? "checked" : "") + ' data-focus-id="' + item.id + '"><span class="focus-text">' + escapeHtml(item.text) + '</span></label></li>').join("") +
        '</ul>' +
        '<button class="button ghost-button" type="button" data-action="edit-focus">' + Icons.edit() + ' ' + t("editFocus") + '</button>' +
      '</article>' +
    '</div>' +
    '<article class="glass-card reminder-summary-card">' +
      '<div class="mood-header">' +
        '<div>' +
          '<span class="eyebrow">' + t("upcoming") + '</span>' +
          '<h2 class="section-title">' + t("remindersThisWeek") + '</h2>' +
        '</div>' +
        '<div>' +
          '<span class="mood-history-score">' + getUpcomingNotifications(7).length + '</span>' +
        '</div>' +
      '</div>' +
      (getUpcomingNotifications(7)[0] ? (function() {
        const alerts = getUpcomingNotifications(7);
        const nextAlert = alerts[0];
        return '<div class="next-reminder">' +
          '<strong>' + escapeHtml(nextAlert.title) + '</strong>' +
          '<span>' + (nextAlert.daysLeft === 0 ? "Today" : nextAlert.daysLeft + " day" + (nextAlert.daysLeft === 1 ? "" : "s") + " left") + '</span>' +
        '</div>' +
        '<div class="reminder-list">' +
          alerts.slice(0, 3).map(item => '<div class="reminder-item"><span class="reminder-dot"></span><div><strong>' + escapeHtml(item.title) + '</strong><small>' + new Date(item.date + "T00:00:00").toLocaleDateString(languageCode() === "km" ? "km-KH" : "en-US", { month: "short", day: "numeric" }) + '</small></div></div>').join("") +
        '</div>';
      })() : '<div class="next-reminder empty-state"><strong>' + t("noRemindersThisWeek") + '</strong><span>' + t("upcomingSpaceClear") + '</span></div>') +
    '</article>' +
    (typeof homePhotoCard === "function" ? homePhotoCard() : '') +
  '</section>';
`;

const fullContent = fs.readFileSync('E:\\Test\\Daily Life 2.0\\js\\dashboard.js', 'utf8');
const start = fullContent.indexOf('function renderHome() {');
const nextFunc = fullContent.indexOf('function homeEmptyCard()');

if (start === -1 || nextFunc === -1) {
  console.error('Could not find function boundaries');
  process.exit(1);
}

const before = fullContent.slice(0, start);
const after = fullContent.slice(nextFunc);
const newContent = before + renderHome + '\\n\\n' + fullContent.slice(nextFunc);

fs.writeFileSync('E:\\Test\\Daily Life 2.0\\js\\dashboard.js', newContent);
console.log('dashboard.js rewritten successfully');