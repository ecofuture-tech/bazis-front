// The component input of shadcn/ui (https://ui.shadcn.com, style new-york-v4),
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
import { cn } from "@/lib/utils"

// a field is its bottom line (the tokens `field-line`, `-hover`, `-focus`, the shadow
// `field-focus`): the inputs, the selects and the pickers; a group of fields
// (`data-slot="field-group"`, a range of dates, a label with its field) has the line, its fields
// none of their own
const fieldClassName =
  "border-b border-(--field-line) bg-transparent transition-[color,border-color,box-shadow] outline-none hover:border-(--field-line-hover) focus-visible:border-(--field-line-focus) focus-visible:shadow-(--shadow-field-focus) aria-invalid:border-destructive disabled:border-dashed in-data-[slot=field-group]:border-0 in-data-[slot=field-group]:focus-visible:shadow-none"
const fieldGroupClassName =
  "border-b border-(--field-line) transition-[border-color,box-shadow] hover:border-(--field-line-hover) focus-within:border-(--field-line-focus) focus-within:shadow-(--shadow-field-focus)"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldClassName,
        "h-9 w-full min-w-0 pointer-coarse:min-h-11 px-3 py-1 text-base selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input, fieldClassName, fieldGroupClassName }
