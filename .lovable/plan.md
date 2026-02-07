
# Plan: Send to All Three Representatives by Default

## Overview
This plan implements a fundamental change to the user flow: instead of selecting a single representative on the landing page, users will now see all three of their congressional representatives (1 House Rep + 2 Senators) with all pre-selected and undeselectable. This maximizes the likelihood of users sending to all three, which is the desired outcome.

## Changes Required

### 1. Landing Screen (src/components/screens/LandingScreen.tsx)

**Button Text Change:**
- Change "Find My Representative" to "Find My Representatives" (plural)

**API Call Change:**
- Switch from `lookupRepresentatives()` to `lookupRepresentativesAndSenators()` to fetch all three legislators

**Display All Three Representatives:**
- Show all legislators (1 Rep + 2 Senators) as cards
- Add clear visual labels: "Representative" badge for Rep, "Senator" badge for Senators
- All cards appear selected by default (visual selected state)
- Remove click handlers - cards are display-only, not selectable

**State Management:**
- Store the representative AND senators in app state when continuing
- Update the postcard data payload to include `senators` array

**Loading State:**
- Update loading text to "Finding Your Representatives..."

---

### 2. Representative Card Component (src/components/rep/RepresentativeCard.tsx)

**Add Type Badge:**
- Show a badge indicating "Representative" or "Senator" based on `representative.type`
- Position badge prominently for clear differentiation

---

### 3. AI Draft Prompt (supabase/functions/draft-postcard-message/index.ts)

**Remove Rep Greeting from AI Output:**
- Currently the prompt generates `Rep. ${repLastName},` as a greeting
- Change to NOT include any specific representative name in the greeting
- The message should be generic so it can be addressed to any of the three legislators
- Greeting will be added dynamically when displaying/sending each postcard

---

### 4. Review Edit Screen (src/components/screens/ReviewEditScreen.tsx)

**Update "Your message" Label:**
- Change from "Your message" to show all recipient names
- Format: "Your message (addressed to Rep. Matsui, Sen. X, Sen. Y)"
- Pull names from `state.postcardData.representative` and `state.postcardData.senators`

---

### 5. Review Card Screen (src/components/screens/ReviewCardScreen.tsx)

**Title Text Change:**
- Change "Here's how your postcard will look" to "Here's how your postcards will look" (plural)

**Show All Three Addresses in TO Section:**
- Instead of showing just one representative's address, show all three
- Format each as a separate entry in the "TO:" section with clear separation
- Show Rep first, then both Senators

---

### 6. Checkout Screen (src/components/screens/CheckoutScreen.tsx)

**Reorder Cards - Maximum Impact First:**
- Move "Recommended - Maximum Impact" (all three) card to the TOP
- Move "Single Voice" card below it
- Default selection should be `'all-three'` instead of `'rep-only'`

**Update Default Selection State:**
- Change `useState<RecipientSelection>('rep-only')` to `useState<RecipientSelection>('all-three')`

---

## Technical Details

### Type Changes (src/types/index.ts)
No changes needed - `senators` field already exists in `PostcardData` interface.

### State Flow
1. **Landing Screen**: Fetch all three legislators, store rep + senators in state
2. **Craft Message Screen**: No changes needed (generic message input)
3. **Drafting Screen**: AI generates generic message without specific greeting
4. **Review Edit Screen**: Show all three names in the "Your message" label
5. **Review Card Screen**: Show all three addresses, plural title
6. **Checkout Screen**: Default to "all-three" option, reordered cards

### API Response Format
The `lookupRepresentativesAndSenators()` function returns:
```typescript
{
  representatives: Representative[], // Usually 1 House Rep
  senators: Representative[]          // Usually 2 Senators
}
```

### PostcardHero Component (src/components/PostcardHero.tsx)
The title "Here's how your postcard will look" is hardcoded in this component and needs to be updated to plural form.

---

## Implementation Order

1. Update Landing Screen to fetch all three and display them
2. Add type badges to RepresentativeCard
3. Modify AI prompt to remove specific rep greeting
4. Update Review Edit Screen label
5. Update PostcardHero title (affects Review Card Screen)
6. Update Review Card Screen TO section to show all addresses
7. Reorder Checkout Screen cards and change default selection

---

## Edge Cases to Handle

- **Only 1 Senator**: Some states may have vacant seats - handle gracefully
- **Multiple House Reps**: Some ZIP codes span multiple districts - current handling is fine (show all)
- **No greeting in AI message**: Ensure message still sounds natural without specific name
- **Checkout price display**: Ensure $12 bundle price displays correctly as default

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/screens/LandingScreen.tsx` | Button text, API call, display all reps, state handling |
| `src/components/rep/RepresentativeCard.tsx` | Add type badge (Representative/Senator) |
| `supabase/functions/draft-postcard-message/index.ts` | Remove rep-specific greeting from prompt |
| `src/components/screens/ReviewEditScreen.tsx` | Update "Your message" label with all names |
| `src/components/PostcardHero.tsx` | Change title to plural |
| `src/components/screens/ReviewCardScreen.tsx` | Show all three addresses in TO section |
| `src/components/screens/CheckoutScreen.tsx` | Reorder cards, change default to all-three |
