# Design Story: Money Calculator

_Generated: October 7, 2026_

## Design Narrative

Money Calculator is a calm companion for everyday financial awareness. Rather than gamifying or overwhelming users with complex charts, it presents spending information with clarity and restraint—much like checking your balance on a banking app, but with gentle guidance toward your goals.

## Core Theme

**"Calm clarity for conscious spending"** - The design evokes tranquility, trustworthiness, and focus. The interface should feel like a breath of fresh air in the often-stressful world of personal finance.

## Emotional Journey

1. **Onboarding (Calm Setup)** - A welcoming, two-minute flow that feels manageable, not daunting
2. **Daily Check-in (Peace of Mind)** - Quick glance at remaining budget without judgment or alarmist visuals
3. **Logging (Effortless)** - Adding expenses/food feels frictionless with the iOS-style keypad
4. **Awareness (Gentle Nudges)** - Warnings appear softly (orange) before becoming urgent (red)
5. **Control (Confidence)** - Users feel in control of their plan, not overwhelmed by it

## Visual Storytelling Elements

### Ambience
- **Subtle gradient backdrop**: Soft radial gradients in accent colors create a gentle ambient glow, suggesting growth and stability without being distracting
- **Depth through glass**: Floating navigation creates a sense of layering—content flows beneath, actions stay accessible
- **Soft lighting**: Liquid glass sheen mimics iOS' sophisticated light model, adding polish and realism

### Tone & Voice Through UI
- **Minimal copy**: UI text is concise and direct, avoiding financial jargon or preachy language
- **Neutral language**: "Remaining", "Spent", "Days left" feel observational rather than judgmental
- **Gentle indicators**: Chips and colors guide without shaming
- **Human scale**: Generous spacing and clear hierarchy feel welcoming

## User Journey & Peak Moments

### Morning Check-in (Dashboard)
The dashboard is designed as the "moment of clarity"—users see at a glance:
- How much they have left this month
- Today's food budget status
- Quick category breakdown
- Recent activity

The greeting personalizes this moment, while the compact food card respects the requirement that food shouldn't dominate.

### Expense Logging (Quick Action)
Adding an expense via the sheet feels instantaneous. The full-screen keypad, large amount display, and smooth sheet animation make this a low-friction micro-interaction that users will actually do in the moment.

### Food Tracking (Daily Ritual)
The food page supports a daily habit. The carry-over visualization subtly reinforces the "save today, benefit tomorrow" behavior without complex math. Progress bars provide immediate feedback.

### Budget Planning (Intentional Setup)
Onboarding and budget editing emphasize that the plan must sum to 100%—framed as "your money rules" rather than restrictive budgeting. Presets provide safe starting points.

### Settings (Personalization)
Simple, iOS-style rows make configuration feel familiar and non-intimidating.

## Design Decisions & Rationale

### Why iOS Glassmorphism?
- **Familiarity**: Users on iOS instantly recognize the patterns
- **Calm aesthetic**: Translucency feels lighter and less boxed-in than solid panels
- **Focus on content**: Glass for chrome keeps the actual financial data (numbers, lists) as the star
- **Timelessness**: Apple's liquid glass is a considered evolution, not a fleeting trend

### Why Strategic Glass Usage?
- Using glass *only* for floating surfaces (tab bar, sheets) prevents legibility issues
- Solid cards for content ensure text has maximum contrast in all lighting conditions
- Creates clear visual separation between navigation/actions and information

### Why System Colors?
- Automatic dark mode without custom theme logic
- Accessible by default (respecting OS contrast)
- Feels integrated with the device
- Reduces maintenance and cognitive load

### Why Tabular Numbers for Currency?
- Prevents layout shift when amounts change (digits align)
- Critical for scanning financial figures quickly
- More professional and easier to compare

### Why Subtle Motion?
- Motion communicates state changes without distraction
- iOS easing feels natural and responsive
- Respects reduced motion preferences for accessibility
- Enhances perceived performance

## Peak Design Moment

The **bottom sheet with amount keypad** represents the app's peak moment of polish: tapping "+" on food or expenses reveals a smooth-gliding glass sheet with a calculator-style keypad. The large, centered amount display updates in real-time with proper thousand separators. The drag-to-dismiss with grabber feels satisfyingly tactile. This single interaction embodies the "calm clarity" philosophy—powerful yet effortless.

## Consistency Across Screens

- **Navigation**: Tab bar present on all signed-in pages, always in same position with same glass treatment
- **Cards**: Consistent 20px radius, soft shadow, same internal spacing patterns
- **Typography**: Strict hierarchy maintained throughout
- **Colors**: Semantic meaning consistent (orange = warning, red = over, green = positive)
- **Motion**: Same easing curves and timing for similar interactions
- **Spacing**: 4pt-based scale creates rhythm

## Long-term Vision

The design is intentionally restrained to age well. By leaning into iOS native patterns rather than custom ornamentation, the interface remains relevant as the app evolves. The calm aesthetic supports the core mission: helping users build awareness without anxiety—turning money tracking from a chore into a quiet, confidence-building habit.
