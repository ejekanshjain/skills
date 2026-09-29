# Storyboard and Pacing

## Shape of the Tour

A tour runs 60 to 90 seconds: an intro card, 5 to 8 steps, and a closing card.

- **Intro (about 4 seconds):** logo, the product's headline promise, one line naming what it covers.
- **Steps:** follow the product's core loop in the order a customer lives it, for example see, understand, fix, measure, get alerted. One screen per step.
- **Outro (about 4 seconds):** logo, a call to action that exists on the site (start free, book a demo).

Cut steps rather than rush them. If the tour passes 90 seconds, drop the step whose screen repeats an earlier one.

## Each Step

A step is a numbered title card, then the screen, then back to the card color.

- **Card title:** 2 to 5 words, Title Case, an outcome ("Find Out Why You Lose"), not a feature name ("Gap Analysis Module").
- **Card subtitle:** one sentence under 15 words on what the viewer gets.
- **Caption:** one line that stays on screen during the step. Don't repeat the subtitle word for word.
- **Screen time:** 6 to 9 seconds of motion, then stop.

Only claim what the product does. Read the screen and the code before writing a caption.

## Choreography

- Open each screen on its most impressive state: data filled in, the right item selected. Use URL parameters to preselect items instead of clicking through menus.
- Move the cursor to what the caption talks about, then pause 0.5 to 1 second so the viewer can read.
- Sweep across charts slowly so tooltips follow the cursor.
- Scroll in 300 to 600 pixel moves over 1.2 to 1.6 seconds. Never jump.
- Hover over buttons you want noticed, but don't click anything that changes data, sends email or spends money.
- End each step still, holding the final frame about 1 second.
- Use `s.find("text")` to aim at elements, so scenes survive layout changes.

## Pacing Controls

- `pace` scales every move, scroll and pause. Try 0.75, then adjust by 0.05.
- `cardMs` sets how long step cards stay up. Keep it at 900 to 1200.
- `fadeMs` sets the fade between cards and screens. Keep it at 800 to 1000; shorter fades from a dark card to a bright app feel like flashes.

## The Short Loop

For a homepage hero or background, record a 20 to 30 second loop: 4 or 5 screens, 5 to 6 seconds each, slow scrolls, no cursor or captions, crossfaded and seamless. Viewers see it without sound or context, so each screen must read at a glance.

## Review Checklist

- The story makes sense with the sound off and without knowing the product.
- Every caption is true and readable.
- No spinner, empty state, error or debug overlay appears.
- `check.mjs` reports no flashes, and the contact sheet shows each step's key moment.
