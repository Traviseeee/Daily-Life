# MYLIFE · Animation audit — 23 តុលា 2026

ច្បាប់យោង៖ skill **ui-ux-pro-max** ក្រុមទី 7 (Animation)៖ ល្បឿនចលនាត្រូវតាមបរិបទ ចលនាត្រូវមានន័យ ចលនាពេលបិទត្រូវលឿនជាងពេលបើក មិនត្រូវប្រើល្បឿនតែមួយសម្រាប់គ្រប់យ៉ាង មិនត្រូវ animate `width`/`height` ហើយត្រូវគោរព reduced-motion។
វិធីវាស់៖ ពិនិត្យកូដ CSS ទាំង 45 files + វាស់លើទំព័រពិត 8 ទំព័រ (390px) ដោយប្រើ `document.getAnimations()` និង FPS។
**បញ្ជីប៉ុណ្ណោះ មិនទាន់កែកូដទេ។**

## ✅ អ្វីដែលល្អរួចហើយ
- **Reduced motion**៖ `css/global.css` បិទចលនាទាំងអស់ (animation + transition) ពេលទូរសព្ទបើក "Reduce Motion"
- **ប្ដូរទំព័រលឿន**៖ ពីចុចរហូតដល់ឃើញទំព័រថ្មីប្រើ ~70ms, មាន `pageIn` 220ms ទន់ៗ
- **Transition ភាគច្រើនមានល្បឿនល្អ**៖ 140–220ms (ពេញនិយមបំផុតគឺ 160ms ចំនួន 28 កន្លែង)
- **ប៊ូតុងមាន feedback ពេលចុច**៖ `.button:active`, `.icon-button:active`
- **ចលនាដែលរត់គ្មានឈប់ មិនរត់នៅពេលមើលមិនឃើញ** (off-screen 0) ហើយ FPS 61 នៅលើ PC
- Keyframes 76 គ្មានឈ្មោះស្ទួន, ប្រើ `transition: all` តែ 3 កន្លែង

## 🔴 1 · ចលនាដែលរត់គ្មានឈប់ ហើយស៊ីថ្ម (ធ្ងន់ជាងគេ)
វាស់ឃើញនៅគ្រប់ទំព័រ (2–6 ក្នុងមួយទំព័រ)៖

| ចលនា | កន្លែង | បញ្ហា |
|---|---|---|
| `activePulse` 2.2s ∞ | ប៊ូតុង bottom nav ដែលកំពុងជ្រើស (`css/layout.css`) | animate **`box-shadow`** = browser ត្រូវគូរឡើងវិញគ្រប់ frame ជារៀងរហូត |
| `quickActionPulse` 3.6s ∞ | ប៊ូតុង ＋ ពណ៌ទឹកក្រូច (`css/components.css`) | **`box-shadow`** ដដែល, បង្ហាញគ្រប់ទំព័រ |
| `homeNudgeShine` 7s ∞ | កាតបញ្ហាប្រចាំថ្ងៃនៅ Home (`css/responsive.css`) | animate **`background-position`** (ធ្ងន់) |
| `tw-spin` 14s ∞ + `tw-pulse` 3.2s ∞ | icon អាកាសធាតុនៅ topbar (`css/topbar.css`) | ប្រើ `transform` (ស្រាល) តែរត់គ្រប់ទំព័រ ជារៀងរហូត |
| ផ្សេងៗ (ពេលបើកផ្ទាំងនោះ) | `fgShine` (family-group), `heroGlow`, `iconFloat` (`filter`), `launcherArtFloat`, `tickerScroll` 28s, `homeNudgeFloat` ×3 | មាន 28 ចលនាដែលរត់គ្មានឈប់ក្នុងកូដ |

**ណែនាំ៖**
- ប្ដូរ pulse ដែលប្រើ `box-shadow` → ប្រើ `::after` ជាមួយ `transform: scale` + `opacity` (GPU, មិនបាច់គូរឡើងវិញ)
- ឲ្យ pulse រត់ **2–3 ដង** រួចឈប់ (ទាក់ទាញភ្នែកពេលបើកទំព័រ) ជំនួសឲ្យ ∞
- Shine/float/glow៖ រត់តែពេលទើបបង្ហាញ ឬពេលចុច
- Icon អាកាសធាតុ៖ ឈប់បង្វិល ពេលអ្នកប្រើមិនប៉ះ app យូរ

## 🟠 2 · Animate លើ `width` (layout ទាក់ទង)
- Transition `width` 8 កន្លែង៖ progress bar ក្នុង `today.css` (400ms), `components.css` (420ms), `memory-feed.css` (240ms), `scan.css` (200ms), `notification-center.css` (600ms), `theme-polish.css` (500/400/240ms)
- Keyframe `fillIn` (`components.css`) animate `width`
- **ណែនាំ៖** ប្រើ `transform: scaleX()` ជាមួយ `transform-origin: left` (រលូនជាង មិនធ្វើឲ្យ layout គណនាឡើងវិញ)

## 🟠 3 · បិទផ្ទាំងភ្លាមៗ (គ្មានចលនាពេលបិទ)
- `Modal.close()` (`js/components/modal.js`) លុប sheet ចោលភ្លាម ប៉ុន្តែពេលបើកមាន `modalIn` 180ms ដូច្នេះមើលទៅដាច់ៗ
- Toast ក៏បាត់ភ្លាមដែរ (`toastIn` មាន តែគ្មាន `toastOut`)
- Bottom sheets (Memories, Notification Center) រអិលឡើង តែបិទភ្លាម
- **ណែនាំ៖** ចលនាចេញ **120–150ms `ease-in`** (លឿនជាងពេលចូល) ដោយរអិលចុះ + fade រួចទើបលុប (`money-ask.css` មាន `.is-closing` ជាគំរូរួចហើយ)

## 🟡 4 · ល្បឿន និង easing មិនស្របគ្នា
- **Easing៖** `ease` ប្រើ **292** ដង, `ease-out` តែ 7, `ease-in` 0; មាន `cubic-bezier` ខុសៗគ្នា 6+ ប្រភេទ
- **ល្បឿន animation៖** 160ms ដល់ 28s មាន **40+ តម្លៃខុសគ្នា** (180, 200, 220, 240, 260, 300, 320, 360…)
- **ណែនាំ៖** បង្កើត token តែមួយកន្លែង៖
  - `--dur-fast: 120ms` (hover, ចុច)
  - `--dur-base: 200ms` (ប៊ូតុង, ប្ដូរ tab)
  - `--dur-slow: 320ms` (sheet, modal ចូល)
  - `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)` សម្រាប់ចូល
  - `--ease-in: cubic-bezier(0.4, 0, 1, 1)` សម្រាប់ចេញ
  - ហើយប្ដូរ `transition: all` 3 កន្លែងទៅជា property ជាក់លាក់

## 🟢 5 · ចលនាដែលអាចបន្ថែមឲ្យមានន័យ (optional)
- **Bottom sheet អូសចុះដើម្បីបិទ** (drag-to-dismiss) នៅលើទូរសព្ទ
- **ចំនួនលុយរាប់ឡើង** (count-up 400ms) ពេលបើក Money/Home ម្ដង (មិនរាប់រាល់ពេល render)
- **Skeleton shimmer** ពេលកំពុងទាញទិន្នន័យពី cloud ជំនួសឲ្យទំព័រទទេ
- **ពេលរក្សាទុកជោគជ័យ**៖ icon ✓ លោតតូចមួយ (ដូចពេលដោះសោ app lock)

## លំដាប់កែដែលណែនាំ
1. **Pulse ∞ → transform/opacity + រត់ 2–3 ដង** (nav, ＋, shine) ដើម្បីសន្សំថ្មទូរសព្ទ — តូច, ផលធំ
2. **Modal/Toast/Sheet មានចលនាពេលបិទ** 120–150ms
3. **Progress bar `width` → `scaleX`**
4. **Motion tokens** (ល្បឿន + easing) ហើយប្ដូរ `transition: all`
5. (Optional) drag-to-dismiss, count-up, skeleton
