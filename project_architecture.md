# 🏗️ Project Architecture Blueprint

_Corrected after Phase 2 Architecture Audit. Both schemas are now aligned with each other and with current business requirements._

## 📚 Database Schema (DBML)

```
Project t_shirts {
  database_type: 'PostgreSQL'
  Note: 'E-commerce DB'
}

Enum user_role {
  manager
  client
  delivery_person
}

Enum order_status {
  pending
  paid
  processing
  shipped
  delivered
  cancelled
}

Enum promo_type {
  percentage
  fixed_amount
}

Enum payment_status {
  pending
  failed
  succeeded
}

Enum payment_method {
  payment_link
  payment_intent
}

Table users {
  id uuid [primary key]
  role user_role [default: 'client']
  stripe_customer_id varchar [null]
  email varchar [unique]
  password_hash varchar
  full_name varchar
  reset_password_token_hash varchar [null]
  reset_password_expires timestamp [null]
  created_at timestamp
  updated_at timestamp
  deleted_at timestamp
}

Table user_addresses {
  id uuid [primary key]
  user_id uuid [ref: > users.id]
  address_line varchar
  city varchar
  country varchar
  postal_code varchar
  created_at timestamp
  updated_at timestamp
  deleted_at timestamp
}

Table refresh_tokens {
  id uuid [primary key]
  user_id uuid [ref: > users.id]
  token_hash varchar
  expires_at timestamp
  revoked_at timestamp
  created_at timestamp
}

Table categories {
  id uuid [primary key]
  name varchar
  created_at timestamp
  updated_at timestamp
  deleted_at timestamp
}

// One-to-many: each product belongs to one category
Table products {
  id uuid [primary key]
  name varchar
  description text
  is_active bool [default: true]
  created_at timestamp
  updated_at timestamp
  deleted_at timestamp
}

Table product_categories {
  product_id uuid [ref: > products.id]
  category_id uuid [ref: > categories.id]
  indexes {
    (product_id, category_id) [pk]
  }
}

Table product_variants {
  id uuid [primary key]
  product_id uuid [ref: > products.id]
  sku varchar [unique]
  price int [note: 'Price in cents']
  stock_quantity integer
  created_at timestamp
  updated_at timestamp
  deleted_at timestamp
}

Table product_options {
  id uuid [primary key]
  product_id uuid [ref: > products.id]
  name varchar [note: 'e.g. Color, Size']
  created_at timestamp
}

Table product_option_values {
  id uuid [primary key]
  option_id uuid [ref: > product_options.id]
  value varchar [note: 'e.g. Red, XL']
  created_at timestamp
}

// pivot links Variant <-> Value
Table product_variant_values {
  product_variant_id uuid [ref: > product_variants.id]
  product_option_value_id uuid [ref: > product_option_values.id]

  indexes {
    (product_variant_id, product_option_value_id) [pk]
  }
}

Table product_images {
  id uuid [primary key]
  product_id uuid [ref: > products.id, null]
  product_variant_id uuid [ref: > product_variants.id, null]
  is_main boolean
  key text
  created_at timestamp
}


Table cart_items {
  id uuid [primary key]
  user_id uuid [ref: > users.id]
  product_variant_id uuid [ref: > product_variants.id]
  quantity integer

  indexes {
    (user_id, product_variant_id) [unique]
  }
}

Table orders {
  id uuid [primary key]
  user_id uuid [ref: > users.id]
  status order_status [default: 'pending']
  delivery_person_id uuid [ref: > users.id, null]
  shipping_address_snapshot jsonb
  promo_code_id uuid [ref: > promo_codes.id, null]
  promo_snapshot jsonb [note: 'stores {code, value, type}', null]
  subtotal int [note: 'Sum of items before discount']
  discount_amount int [default: 0]
  total_amount int
  created_at timestamp
  updated_at timestamp
}

Table order_items {
  id uuid [primary key]
  order_id uuid [ref: > orders.id]
  product_variant_id uuid [ref: > product_variants.id]
  quantity integer
  unit_price_at_purchase int
  total_price int
  product_snapshot jsonb [note: 'variant & options']
}

Table payments {
  id uuid [primary key]
  order_id uuid [ref: > orders.id]
  stripe_payment_id text
  stripe_session_id text [null]
  payment_method payment_method
  status payment_status [default: 'pending']
  receipt_url text
  currency varchar
  amount int
  payment_date timestamp
}

Table favorites {
  id uuid [primary key]
  user_id uuid [ref: > users.id]
  variant_id uuid [ref: > product_variants.id]
  created_at timestamp

  indexes {
    (user_id, variant_id) [unique]
  }
}

Table promo_codes {
  id uuid [primary key]
  code text [unique]
  type promo_type
  value int
  expires_at timestamp
  usage_limit int
  usage_count int [default: 0]
  min_purchase int [null]
  is_active boolean [default: true]
  created_at timestamp
  updated_at timestamp
}

```

## 📝 GraphQL Schema (SDL)

```graphql
# Custom Scalar Types
"""
ISO-8601 UTC DateTime (e.g. 2026-02-06T15:30:00Z)
"""
scalar DateTime

enum Role {
  CLIENT
  MANAGER
  DELIVERY_PERSON
}

enum OrderStatus {
  PENDING
  PAID
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  SUCCEEDED
  FAILED
}

enum PromoType {
  PERCENTAGE
  FIXED_AMOUNT
}

enum PaymentMethod {
  PAYMENT_LINK
  PAYMENT_INTENT
}

# ─────────────────────────────────────────────────
# OBJECT TYPES
# ─────────────────────────────────────────────────

"""
Monetary amount with currency and formatted display
"""
type Address {
  id: ID!
  addressLine: String!
  city: String!
  country: String!
  postalCode: String!
}

type User {
  id: ID!
  email: String!
  fullName: String
  role: Role!
  addresses: [Address!]
}

type Category {
  id: ID!
  name: String!
  products: [Product!]
}

type Product {
  id: ID!
  name: String!
  description: String!
  categories: [Category!]!
  featuredImage: Image
  images: [Image!]!
  options: [ProductOption!]!
  variants: [Variant!]!
  """
  Whether product is active and visible to customers
  """
  isActive: Boolean!
  """
  Soft delete timestamp (null if not deleted)
  """
  deletedAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
}

"""
Product option (e.g., Color with values ["Red", "Blue"])
"""
type ProductOption {
  id: ID!
  """
  Option name (e.g., "Color", "Size")
  """
  name: String!
  """
  Available values (e.g., ["S", "XL", "L"])
  """
  values: [String!]!
}

type Variant {
  id: ID!

  """
  Unique stock keeping unit
  """
  sku: String!
  price: Int!
  stockQuantity: Int!
  product: Product!
  imageUrl: String
  """
  Selected options for this variant (e.g., Color: Red, Size: M)
  """
  selectedOptions: [SelectedOption!]!
  """
  Whether the authenticated user has liked this variant.
  Always false for unauthenticated requests.
  """
  isFavorite: Boolean!
}

type SelectedOption {
  """
  Option name (e.g., "Color")
  """
  name: String!
  """
  Selected value (e.g., "Red")
  """
  value: String!
}

type Image {
  id: ID!
  url: String!
  isMain: Boolean!
}

type Favorite {
  id: ID!
  variant: Variant!
  createdAt: DateTime!
}

type CartItem {
  id: ID!
  quantity: Int!
  variant: Variant!
  """
  Subtotal for this item (price × quantity)
  """
  subtotal: Int!
}

type Cart {
  id: ID!
  items: [CartItem!]!
  totalQuantity: Int!
  """
  Sum of all item subtotals
  """
  subtotal: Int!
  """
  Final total (currently same as subtotal, placeholder for tax/discount)
  """
  grandTotal: Int!
}

type Order {
  id: ID!
  status: OrderStatus!
  """
  Sum of items before discount
  """
  subtotal: Int!
  """
  Discount amount applied (0 if none)
  """
  discountAmount: Int!
  """
  Final total after discount
  """
  totalAmount: Int!
  """
  Promo code used (from snapshot), null if none
  """
  promoCode: String
  """
  Snapshot of shipping address at time of order
  """
  shippingAddress: Address!
  items: [OrderItem!]!
  payments: [Payment!]!
  createdAt: DateTime!
}

"""
Order item with snapshot data (product/variant details at time of purchase)
"""
type OrderItem {
  id: ID!
  """
  Product title at time of purchase
  """
  productTitle: String!
  """
  Variant title at time of purchase
  """
  variantTitle: String!
  quantity: Int!
  """
  Unit price at time of purchase
  """
  price: Int!
  """
  Total for this line item (price × quantity)
  """
  total: Int!
}

type Payment {
  id: ID!
  amount: Int!
  paymentMethod: PaymentMethod!
  status: PaymentStatus!
  """
  Stripe receipt URL (if available)
  """
  receiptUrl: String
  createdAt: DateTime!
}

type PromoCode {
  id: ID!
  code: String!
  type: PromoType!
  value: Int!
  expiresAt: DateTime!
  usageLimit: Int!
  usageCount: Int!
  minPurchase: Int
  isActive: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime!
}

# ─────────────────────────────────────────────────
# ROOT QUERY
# ─────────────────────────────────────────────────

type Query {
  # --- PUBLIC ---
  product(id: ID!): Product
  products(limit: Int = 15, offset: Int = 0, categoryId: ID): PaginatedProducts!

  categories: [Category!]!

  # --- AUTHENTICATED USER ---
  me: User
  myCart: Cart
  myFavorites: [Favorite!]!

  # --- UNIFIED QUERIES (Filtered by CASL) ---

  """
  Get a specific order by ID.
  Access is determined by user role via CASL.
  """
  order(id: ID!): Order

  """
  Get orders with optional filters.
  - Clients see their own orders.
  - Delivery persons see their assigned orders.
  - Managers see all orders.
  """
  orders(
    filter: OrderFilterInput
    limit: Int = 20
    offset: Int = 0
  ): PaginatedOrders!

  # --- MANAGER ONLY ---
  promoCodes: [PromoCode!]!
}

# ─────────────────────────────────────────────────
# PAGINATION
# ─────────────────────────────────────────────────

type PaginatedProducts {
  """
  list of products in the current page(based on limit and offset).
  """
  items: [Product!]!
  page: Int!
  limit: Int!
  totalItems: Int!
  totalPages: Int!
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
}

type PaginatedOrders {
  items: [Order!]!
  page: Int!
  limit: Int!
  totalItems: Int!
  totalPages: Int!
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
}

# ─────────────────────────────────────────────────
# ROOT MUTATIONS
# ─────────────────────────────────────────────────

type Mutation {
  # ADDRESSES
  addAddress(input: CreateAddressInput!): Address!
  updateAddress(id: ID!, input: UpdateAddressInput!): Address!
  deleteAddress(id: ID!): Address!

  # FAVORITES
  toggleFavorite(variantId: ID!): Boolean!

  # CATEGORIES (manager)
  """
  Create category. Requires MANAGER role.
  """
  createCategory(input: CreateCategoryInput!): Category!
  updateCategory(id: ID!, input: UpdateCategoryInput): Category!
  """
  Soft delete category. Returns ID of deleted category.
  Requires MANAGER role.
  """
  deleteCategory(id: ID!): Category!

  # PRODUCTS (manager)
  """
  Create new product with variants.
  Requires MANAGER role.
  """
  createProduct(input: CreateProductInput!): Product!
  """
  Update product details.
  Does not affect variants or images.
  Requires MANAGER role.
  """
  updateProduct(id: ID!, input: UpdateProductInput!): Product!
  """
  Soft delete product. Returns ID of deleted product.
  Requires MANAGER role.
  """
  deleteProduct(id: ID!): Product!
  """
  Disable product (sets isActive = false).
  Requires MANAGER role.
  """
  disableProduct(id: ID!): Product!
  """
  Enable product (sets isActive = true).
  Requires MANAGER role.
  """
  enableProduct(id: ID!): Product!

  # VARIANTS (manager)
  """
  Add new variant to existing product.
  Requires MANAGER role.
  """
  addVariant(productId: ID!, input: CreateVariantInput!): Product!
  """
  Update existing product variant.
  Requires MANAGER role.
  """
  updateVariant(id: ID!, input: UpdateVariantInput!): Product!
  """
  Delete product variant. Returns updated product.
  Requires MANAGER role.
  """
  deleteVariant(id: ID!): Product!

  # IMAGES (manager)
  """
  Add image to product gallery.
  Requires MANAGER role.
  """
  addProductImage(id: ID!, input: AddImageInput): Product!
  """
  Delete image from product gallery.
  Requires MANAGER role.
  """
  deleteProductImage(id: ID!): Product!

  # CART (client)
  """
  Add item to cart.
  If variant already exists in cart, increases quantity.
  Creates cart on first use.
  """
  addItemToCart(input: AddToCartInput!): Cart!
  """
  Update cart item quantity.
  Quantity must be >= 1. Use removeItemFromCart to delete items.
  """
  updateCartItemQuantity(id: ID!, quantity: Int!): Cart!
  """
  Remove item from cart.
  """
  removeItemFromCart(id: ID!): Cart!
  """
  Remove all items from cart.
  """
  clearCart: Cart!

  # CHECKOUT (client)
  """
  Create order from current cart.
  Clears cart items on success.
  """
  checkout(input: CheckoutInput!): Order!

  # ORDER STATUS
  """
  Update order status.
  Manager: paid → processing → shipped.
  Delivery Person: shipped → delivered.
  Enforced via CASL.
  """
  updateOrderStatus(id: ID!, status: OrderStatus!): Order!

  """
  Cancel an order.
  Only allowed before shipped status.
  Client can cancel own orders.
  """
  cancelOrder(id: ID!): Order!

  # PAYMENT
  """
  Create Stripe payment intent for order (cart checkout).
  Returns client secret for Stripe frontend confirmation.
  """
  createPaymentIntent(orderId: ID!): PaymentIntentResult!

  # PROMO CODES (manager)
  """
  Create a new promo code. Requires MANAGER role.
  """
  createPromoCode(input: CreatePromoCodeInput!): PromoCode!
  """
  Update a promo code. Requires MANAGER role.
  """
  updatePromoCode(id: ID!, input: UpdatePromoCodeInput!): PromoCode!
  """
  Disable a promo code. Requires MANAGER role.
  """
  disablePromoCode(id: ID!): PromoCode!
  """
  Enable a promo code. Requires MANAGER role.
  """
  enablePromoCode(id: ID!): PromoCode!
}

# ─────────────────────────────────────────────────
# INPUT TYPES
# ─────────────────────────────────────────────────

# User / Addresses
input CreateAddressInput {
  addressLine: String!
  city: String!
  country: String!
  postalCode: String!
}

input UpdateAddressInput {
  addressLine: String
  city: String
  country: String
  postalCode: String
}

# Categories
input CreateCategoryInput {
  name: String!
}

input UpdateCategoryInput {
  name: String
}

# Products
input CreateProductInput {
  title: String!
  description: String!
  categoryId: ID!
  """
  Image URLs for product gallery
  """
  images: [String!]
  """
  Product options (e.g., [{name: "Color", values: ["Red", "Blue"])
  """
  options: [ProductOptionInput!]!
  """
  Product variants (at least one required)
  """
  variants: [CreateVariantInput!]!
}

input UpdateProductInput {
  title: String
  description: String
  categoryId: ID
  #isActive: Boolean
}

# Variants
input ProductOptionInput {
  """
  Option name (e.g., "Color", "Size")
  """
  name: String!
  """
  Available values (e.g., ["Red", "Blue", "Green"])
  """
  values: [String!]!
}

input CreateVariantInput {
  sku: String!
  """
  Price in cents (e.g., 2000 = $20.00)
  """
  price: Int!
  stock: Int!
  selectedOptions: [SelectedOptionInput!]!
  imageUrl: String
}

input UpdateVariantInput {
  sku: String
  price: Int
  stock: Int
  imageUrl: String
}

input SelectedOptionInput {
  """
  Option name (must match ProductOption.name)
  """
  name: String!
  """
  Option value (must be in ProductOption.values)
  """
  value: String!
}

# Images
input AddImageInput {
  url: String!
}

# Cart
input AddToCartInput {
  variantId: ID!
  """
  Quantity to add (default: 1)
  """
  quantity: Int! = 1
}

# Checkout
input CheckoutInput {
  """
  Shipping address for this order
  """
  shippingAddressId: ID!
  """
  Optional promo code to apply at checkout
  """
  promoCode: String
}

input OrderFilterInput {
  """
  Filtrar por el estado actual de la orden.
  Útil para el Repartidor (SHIPPED o DELIVERED) y para el Cliente.
  """
  status: OrderStatus

  """
  Rango de fechas: Fecha de inicio (formato ISO 8601, ej. "2026-02-01T00:00:00Z")
  """
  startDate: String

  """
  Rango de fechas: Fecha de fin (formato ISO 8601)
  """
  endDate: String

  """
  Rango de precios: Precio mínimo pagado
  """
  minPrice: Float

  """
  Rango de precios: Precio máximo pagado
  """
  maxPrice: Float
}

# Promo Codes
input CreatePromoCodeInput {
  code: String!
  type: PromoType!
  value: Int!
  expiresAt: DateTime!
  usageLimit: Int!
  minPurchase: Int
}

input UpdatePromoCodeInput {
  code: String
  type: PromoType
  value: Int
  expiresAt: DateTime
  usageLimit: Int
  minPurchase: Int
}

# ─────────────────────────────────────────────────
# RESPONSE TYPES
# ─────────────────────────────────────────────────

type PaymentIntentResult {
  """
  Stripe client secret for frontend confirmation
  """
  clientSecret: String!
  amount: Int!
}
```
