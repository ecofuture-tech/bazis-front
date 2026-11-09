// The component button of shadcn/ui (https://ui.shadcn.com, style new-york-v4),
// copied by bazis-front with the aliases of components.json.
//
// MIT License
//
// Copyright (c) 2023 shadcn
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

// a lifted control (`control` of the theme): lighter under the pointer, lower when pressed; a
// toggle that is on (`aria-pressed`) in the tone of the primary, lifted as the others
const raised =
  "control hover:bg-none hover:bg-control-hover hover:shadow-(--shadow-lift-05-hover) active:shadow-(--shadow-lift-05-active) aria-pressed:bg-none aria-pressed:bg-primary-soft aria-pressed:font-semibold aria-pressed:text-primary-ink"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md pointer-coarse:min-h-11 pointer-coarse:min-w-11 text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // a flat fill lifted by a shadow of its own color
        default:
          "bg-primary text-primary-foreground shadow-(--shadow-lift-primary) hover:bg-[color-mix(in_oklab,var(--primary)_94%,white)] hover:shadow-(--shadow-lift-primary-hover) active:bg-[color-mix(in_oklab,var(--primary)_93%,black)] active:shadow-(--shadow-lift-primary-active)",
        // a control with the text in red, never a red block beside the main action
        destructive: cn(
          raised,
          "text-[color-mix(in_srgb,var(--destructive)_78%,var(--foreground))] hover:bg-[color-mix(in_oklab,var(--destructive)_8%,var(--control))]"
        ),
        outline: cn(raised, "hover:text-accent-foreground"),
        secondary: cn(raised, "text-secondary-foreground"),
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
