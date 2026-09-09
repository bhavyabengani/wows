ALTER TYPE "public"."asset_class" ADD VALUE 'fixed_deposit' BEFORE 'cash';--> statement-breakpoint
-- Fixed deposits are their own asset class, not cash: a deposit earns a
-- published rate and carries a lock-in, cash earns nothing, and the rule that
-- cash has no price bars would be contradicted by storing one as the other.
-- Adding a value to an enum is forward-only; it can never be removed, which is
-- why the class list is settled before instruments are loaded against it.
