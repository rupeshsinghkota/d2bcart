-- Create Carts Table
CREATE TABLE IF NOT EXISTS public.carts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE, -- One cart per user
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    recovery_sent_at TIMESTAMP WITH TIME ZONE -- Tracks if we already sent the abandoned cart message
);

-- Enable RLS for Carts
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent errors if re-running
DROP POLICY IF EXISTS "Users can view own cart" ON public.carts;
DROP POLICY IF EXISTS "Users can insert own cart" ON public.carts;
DROP POLICY IF EXISTS "Users can update own cart" ON public.carts;

CREATE POLICY "Users can view own cart" ON public.carts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cart" ON public.carts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cart" ON public.carts
    FOR UPDATE USING (auth.uid() = user_id);

-- Create Cart Items Table
CREATE TABLE IF NOT EXISTS public.cart_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cart_id UUID REFERENCES public.carts(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(cart_id, product_id) -- Prevent duplicate entries for same product in cart
);

-- Enable RLS for Cart Items
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for items
DROP POLICY IF EXISTS "Users can view own cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Users can manage own cart items" ON public.cart_items;

CREATE POLICY "Users can view own cart items" ON public.cart_items
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.carts WHERE id = cart_items.cart_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can manage own cart items" ON public.cart_items
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.carts WHERE id = cart_items.cart_id AND user_id = auth.uid())
    );

-- Add index for finding abandoned carts efficiently
CREATE INDEX IF NOT EXISTS idx_carts_updated_at ON public.carts(updated_at);
