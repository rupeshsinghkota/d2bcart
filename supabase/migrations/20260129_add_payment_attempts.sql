-- Create payment_attempts table to store cart details before payment
CREATE TABLE IF NOT EXISTS payment_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  razorpay_order_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  cart_payload JSONB NOT NULL,
  payment_breakdown JSONB NOT NULL,
  shipping_address JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by Razorpay Order ID
CREATE INDEX IF NOT EXISTS idx_payment_attempts_order_id ON payment_attempts(razorpay_order_id);

-- Add comment
COMMENT ON TABLE payment_attempts IS 'Stores order creation context to allow webhook-based order recovery';
