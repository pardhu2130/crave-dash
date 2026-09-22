import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Dish thumbnail. Uses the menu item's imageUrl when the restaurant has one and
 * falls back to a themed gradient tile with a category emoji, so the UI never
 * shows a broken image.
 */

const EMOJI_RULES: [RegExp, string][] = [
  [/burger|smash/i, "🍔"],
  [/biryani|rice/i, "🍚"],
  [/naan|bread|pita/i, "🫓"],
  [/paneer|tikka|curry|masala|butter chicken/i, "🍛"],
  [/chicken|65|wings/i, "🍗"],
  [/nigiri|sushi|sashimi/i, "🍣"],
  [/roll|maki/i, "🍥"],
  [/miso|soup|ramen/i, "🍜"],
  [/corn/i, "🌽"],
  [/fries/i, "🍟"],
  [/brisket|steak|ribs/i, "🥩"],
  [/cheesecake|tart|éclair|eclair|cake|dessert/i, "🍰"],
  [/espresso|coffee|latte/i, "☕"],
  [/tea/i, "🍵"],
  [/lassi|shake|smoothie|juice/i, "🥤"],
  [/pizza/i, "🍕"],
  [/taco|burrito/i, "🌮"],
  [/salad|greens/i, "🥗"],
];

const GRADIENTS = [
  "from-amber-200/70 via-orange-100 to-rose-100 dark:from-amber-500/25 dark:via-orange-500/10 dark:to-rose-500/10",
  "from-emerald-200/70 via-teal-100 to-sky-100 dark:from-emerald-500/25 dark:via-teal-500/10 dark:to-sky-500/10",
  "from-rose-200/70 via-pink-100 to-violet-100 dark:from-rose-500/25 dark:via-pink-500/10 dark:to-violet-500/10",
  "from-sky-200/70 via-indigo-100 to-cyan-100 dark:from-sky-500/25 dark:via-indigo-500/10 dark:to-cyan-500/10",
  "from-orange-200/70 via-amber-100 to-yellow-100 dark:from-orange-500/25 dark:via-amber-500/10 dark:to-yellow-500/10",
];

function emojiFor(text: string): string {
  for (const [pattern, emoji] of EMOJI_RULES) {
    if (pattern.test(text)) return emoji;
  }
  return "🍽️";
}

function gradientFor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 997;
  }
  return GRADIENTS[hash % GRADIENTS.length];
}

export function FoodTile({
  name,
  category,
  imageUrl,
  className,
  emojiClassName = "text-3xl",
}: {
  name: string;
  category?: string | null;
  imageUrl?: string | null;
  className?: string;
  emojiClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !failed;

  if (showImage) {
    return (
      <img
        src={imageUrl ?? ""}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn("size-16 rounded-lg border object-cover", className)}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={cn(
        "flex size-16 shrink-0 items-center justify-center rounded-lg border bg-gradient-to-br",
        gradientFor(`${name}${category ?? ""}`),
        className,
      )}
    >
      <span className={emojiClassName}>
        {emojiFor(`${category ?? ""} ${name}`)}
      </span>
    </div>
  );
}
