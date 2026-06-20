-- =====================================================================
-- CAFE POS — SCHEMA v2
-- Changes applied in this version (see accompanying explanation doc):
--   1. Auto stock deduction the instant a cashier order is sent to kitchen
--   2. QR self-ordering blocked while a table has any ACTIVE session
--      (cashier-opened or customer-opened) — "Table already occupied"
--   3. Loyalty program: Rs.100 spent = 1 credit, 50 credits = 1 free drink
--      (registered customers only, is_guest = FALSE)
--   4. Waiter role removed. Only two order sources: cashier, self_order.
--   5. Customer QR flow reuses existing customer record by phone number
-- =====================================================================

CREATE DATABASE IF NOT EXISTS cafe_pos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cafe_pos;

-- ---------------------------------------------------------------------
-- ROLES  (waiter removed — cashier IS the floor employee now)
-- ---------------------------------------------------------------------
CREATE TABLE roles (
    id              TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name            VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE users (
    id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name            VARCHAR(100)  NOT NULL,
    email           VARCHAR(150)  NOT NULL,
    mobile_number   VARCHAR(15)   NOT NULL,
    password_hash   VARCHAR(255)  NOT NULL,
    role_id         TINYINT UNSIGNED NOT NULL,
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP     NULL DEFAULT NULL,
    CONSTRAINT uq_users_email   UNIQUE (email),
    CONSTRAINT uq_users_mobile  UNIQUE (mobile_number),
    CONSTRAINT fk_users_role    FOREIGN KEY (role_id) REFERENCES roles(id),
    CONSTRAINT chk_users_email  CHECK (email LIKE '%_@_%._%'),
    CONSTRAINT chk_users_mobile CHECK (CHAR_LENGTH(mobile_number) BETWEEN 10 AND 15)
);

CREATE TABLE user_sessions_log (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id         INT UNSIGNED NOT NULL,
    login_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    logout_at       TIMESTAMP NULL,
    ip_address      VARCHAR(45) NULL,
    user_agent      TEXT NULL,
    CONSTRAINT fk_usl_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- CUSTOMERS  (+ loyalty balance, registered-only)
-- ---------------------------------------------------------------------
CREATE TABLE customers (
    id                  INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name                VARCHAR(100) NOT NULL,
    email               VARCHAR(150) NULL,
    mobile_number       VARCHAR(15)  NOT NULL,
    password_hash       VARCHAR(255) NULL,
    is_guest            BOOLEAN NOT NULL DEFAULT TRUE,
    loyalty_credits     INT UNSIGNED NOT NULL DEFAULT 0,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_customers_mobile UNIQUE (mobile_number),
    CONSTRAINT chk_customers_email CHECK (email IS NULL OR email LIKE '%_@_%._%'),
    CONSTRAINT chk_customers_mobile CHECK (CHAR_LENGTH(mobile_number) BETWEEN 10 AND 15),
    -- Guests can never carry a loyalty balance — enforced at the DB level
    CONSTRAINT chk_customers_loyalty_guest CHECK (is_guest = FALSE OR loyalty_credits = 0)
);

-- Every earn / redeem event — the audit trail behind customers.loyalty_credits.
-- customers.loyalty_credits is a running cache; this table is the source of truth.
CREATE TABLE loyalty_ledger (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    customer_id     INT UNSIGNED NOT NULL,
    order_id        INT UNSIGNED NULL,
    entry_type      ENUM('earn','redeem','adjustment') NOT NULL,
    credits_delta   INT NOT NULL,                  -- positive for earn/adjustment-up, negative for redeem
    balance_after   INT UNSIGNED NOT NULL,         -- snapshot of customers.loyalty_credits right after this entry
    note            VARCHAR(255) NULL,
    created_by      INT UNSIGNED NULL,              -- cashier/user who triggered it (NULL for pure system earn events)
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_loyalty_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    CONSTRAINT fk_loyalty_user     FOREIGN KEY (created_by)  REFERENCES users(id),
    CONSTRAINT chk_loyalty_delta_nonzero CHECK (credits_delta <> 0)
);
-- fk_loyalty_order added after `orders` table is created further below.

-- ---------------------------------------------------------------------
-- CATALOG
-- ---------------------------------------------------------------------
CREATE TABLE categories (
    id              SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name            VARCHAR(60) NOT NULL,
    color_hex       CHAR(7) NOT NULL DEFAULT '#CCCCCC',
    display_order   TINYINT UNSIGNED NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_categories_name UNIQUE (name),
    CONSTRAINT chk_categories_color CHECK (color_hex REGEXP '^#[0-9A-Fa-f]{6}$')
);

CREATE TABLE products (
    id                  INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    category_id         SMALLINT UNSIGNED NOT NULL,
    name                VARCHAR(120) NOT NULL,
    price               DECIMAL(10,2) NOT NULL,
    uom                 VARCHAR(20) NOT NULL DEFAULT 'piece',
    tax_percent         DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    description         TEXT NULL,
    image_url           VARCHAR(500) NULL,
    kds_visible         BOOLEAN NOT NULL DEFAULT TRUE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    -- marks the single fixed product redeemable via loyalty credits
    is_loyalty_reward    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id),
    CONSTRAINT chk_products_price CHECK (price >= 0),
    CONSTRAINT chk_products_tax   CHECK (tax_percent >= 0 AND tax_percent <= 100)
);

-- Only ONE product in the whole catalog may be the loyalty reward item.
CREATE UNIQUE INDEX uq_products_single_loyalty_reward
    ON products ((CASE WHEN is_loyalty_reward = TRUE THEN TRUE ELSE NULL END));

CREATE TABLE inventory_items (
    id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    product_id      INT UNSIGNED NOT NULL,
    sku             VARCHAR(50) NOT NULL,
    unit            VARCHAR(20) NOT NULL DEFAULT 'piece',
    current_stock   DECIMAL(10,2) NOT NULL DEFAULT 0,
    reorder_level   DECIMAL(10,2) NOT NULL DEFAULT 0,
    max_stock       DECIMAL(10,2) NULL,
    is_perishable   BOOLEAN NOT NULL DEFAULT FALSE,
    expiry_date     DATE NULL,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_inventory_product UNIQUE (product_id),
    CONSTRAINT uq_inventory_sku UNIQUE (sku),
    CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT chk_inventory_stock CHECK (current_stock >= 0)
);

CREATE TABLE stock_movements (
    id                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    inventory_item_id   INT UNSIGNED NOT NULL,
    movement_type       ENUM('purchase_in','sale_out','wastage','adjustment','return_in') NOT NULL,
    quantity            DECIMAL(10,2) NOT NULL,
    reference_order_id  INT UNSIGNED NULL,
    performed_by        INT UNSIGNED NULL,   -- nullable: system-triggered sale_out has no human actor
    note                VARCHAR(255) NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sm_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_sm_user FOREIGN KEY (performed_by) REFERENCES users(id),
    CONSTRAINT chk_sm_qty CHECK (quantity > 0)
);

CREATE TABLE suppliers (
    id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name            VARCHAR(120) NOT NULL,
    contact_person  VARCHAR(100) NULL,
    mobile_number   VARCHAR(15) NULL,
    email           VARCHAR(150) NULL,
    address         VARCHAR(255) NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE purchase_orders (
    id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    supplier_id     INT UNSIGNED NOT NULL,
    status          ENUM('draft','ordered','received','cancelled') NOT NULL DEFAULT 'draft',
    notes           TEXT NULL,
    created_by      INT UNSIGNED NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    received_at     TIMESTAMP NULL,
    CONSTRAINT fk_po_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    CONSTRAINT fk_po_user FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE purchase_order_items (
    id                  INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    purchase_order_id   INT UNSIGNED NOT NULL,
    inventory_item_id   INT UNSIGNED NOT NULL,
    quantity            DECIMAL(10,2) NOT NULL,
    unit_cost           DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_poi_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_poi_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
    CONSTRAINT chk_poi_qty CHECK (quantity > 0),
    CONSTRAINT chk_poi_cost CHECK (unit_cost >= 0)
);

CREATE TABLE payment_methods (
    id              TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    type            ENUM('cash','card_digital','upi') NOT NULL UNIQUE,
    is_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
    upi_id          VARCHAR(100) NULL,
    display_name    VARCHAR(50) NULL,
    CONSTRAINT chk_pm_upi CHECK (
        type <> 'upi'
        OR is_enabled = FALSE
        OR (is_enabled = TRUE AND upi_id IS NOT NULL)
    )
);

CREATE TABLE floors (
    id              TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name            VARCHAR(60) NOT NULL UNIQUE,
    display_order   TINYINT UNSIGNED NOT NULL DEFAULT 0
);

CREATE TABLE tables_master (
    id              SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    floor_id        TINYINT UNSIGNED NOT NULL,
    table_number    VARCHAR(10) NOT NULL,
    seats           TINYINT UNSIGNED NOT NULL DEFAULT 2,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    qr_token        CHAR(36) NOT NULL,
    CONSTRAINT uq_tables_floor_number UNIQUE (floor_id, table_number),
    CONSTRAINT uq_tables_qr_token UNIQUE (qr_token),
    CONSTRAINT fk_tables_floor FOREIGN KEY (floor_id) REFERENCES floors(id),
    CONSTRAINT chk_tables_seats CHECK (seats > 0)
);

-- ---------------------------------------------------------------------
-- TABLE SESSIONS
-- ---------------------------------------------------------------------
CREATE TABLE table_sessions (
    id               BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    table_id         SMALLINT UNSIGNED NOT NULL,
    status           ENUM('active','closed') NOT NULL DEFAULT 'active',
    opened_by        ENUM('cashier','customer_qr') NOT NULL,
    opened_by_user_id INT UNSIGNED NULL,     -- set when opened_by = 'cashier'
    lock_mode        ENUM('device','pin') NOT NULL DEFAULT 'device',
    device_token     CHAR(36) NULL,
    pin_code         CHAR(4) NULL,
    opened_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at        TIMESTAMP NULL,
    last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    -- generated column: NULL unless status='active', so the unique index
    -- below only ever blocks a SECOND active row for the same table.
    active_table_id  SMALLINT UNSIGNED GENERATED ALWAYS AS (
                          CASE WHEN status = 'active' THEN table_id ELSE NULL END
                      ) STORED,
    CONSTRAINT fk_ts_table FOREIGN KEY (table_id) REFERENCES tables_master(id),
    CONSTRAINT fk_ts_user  FOREIGN KEY (opened_by_user_id) REFERENCES users(id),
    CONSTRAINT chk_ts_pin CHECK (lock_mode <> 'pin' OR pin_code REGEXP '^[0-9]{4}$'),
    CONSTRAINT chk_ts_opener CHECK (
        (opened_by = 'cashier'    AND opened_by_user_id IS NOT NULL)
        OR
        (opened_by = 'customer_qr' AND opened_by_user_id IS NULL)
    ),
    CONSTRAINT uq_ts_one_active_per_table UNIQUE (active_table_id)
);

CREATE TABLE pin_rate_limits (
    id               INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    table_session_id BIGINT UNSIGNED NOT NULL,
    ip_address       VARCHAR(45) NOT NULL,
    failed_attempts  TINYINT UNSIGNED NOT NULL DEFAULT 0,
    locked_until     TIMESTAMP NULL,
    last_attempt_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_prl_session FOREIGN KEY (table_session_id) REFERENCES table_sessions(id) ON DELETE CASCADE,
    CONSTRAINT uq_prl_session_ip UNIQUE (table_session_id, ip_address)
);

CREATE TABLE pos_sessions (
    id           INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id      INT UNSIGNED NOT NULL,
    status       ENUM('open','closed') NOT NULL DEFAULT 'open',
    opening_cash DECIMAL(10,2) NOT NULL DEFAULT 0,
    closing_cash DECIMAL(10,2) NULL,
    notes        VARCHAR(500) NULL,
    opened_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at    TIMESTAMP NULL,
    CONSTRAINT fk_pos_sessions_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE coupons (
    id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    code          VARCHAR(30) NOT NULL UNIQUE,
    discount_type ENUM('percent','fixed') NOT NULL,
    value         DECIMAL(10,2) NOT NULL,
    max_uses      INT UNSIGNED NULL,
    used_count    INT UNSIGNED NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from    DATE NULL,
    valid_until   DATE NULL,
    created_by    INT UNSIGNED NOT NULL,
    CONSTRAINT fk_coupons_user FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT chk_coupons_value CHECK (value > 0),
    CONSTRAINT chk_coupons_percent CHECK (discount_type <> 'percent' OR value <= 100)
);

CREATE TABLE promotions (
    id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name              VARCHAR(100) NOT NULL,
    scope             ENUM('product','order') NOT NULL,
    product_id        INT UNSIGNED NULL,
    min_quantity      INT UNSIGNED NULL,
    min_order_amount  DECIMAL(10,2) NULL,
    discount_type     ENUM('percent','fixed') NOT NULL,
    value             DECIMAL(10,2) NOT NULL,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from        DATE NULL,
    valid_until       DATE NULL,
    CONSTRAINT fk_promo_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT chk_promo_scope CHECK (
        (scope = 'product' AND product_id IS NOT NULL AND min_quantity IS NOT NULL)
        OR
        (scope = 'order' AND min_order_amount IS NOT NULL)
    ),
    CONSTRAINT chk_promo_value CHECK (value > 0),
    CONSTRAINT chk_promo_percent CHECK (discount_type <> 'percent' OR value <= 100)
);

-- ---------------------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------------------
CREATE TABLE orders (
    id                    INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    order_number          VARCHAR(20) NOT NULL UNIQUE,
    source                ENUM('cashier','self_order') NOT NULL,
    table_id              SMALLINT UNSIGNED NULL,
    table_session_id      BIGINT UNSIGNED NULL,
    customer_id           INT UNSIGNED NULL,
    pos_session_id        INT UNSIGNED NULL,
    placed_by_user_id     INT UNSIGNED NULL,
    status                ENUM('draft','sent_to_kitchen','paid','cancelled') NOT NULL DEFAULT 'draft',
    coupon_id             INT UNSIGNED NULL,
    subtotal              DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_total              DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_total        DECIMAL(10,2) NOT NULL DEFAULT 0,
    total                  DECIMAL(10,2) NOT NULL DEFAULT 0,
    loyalty_credits_earned INT UNSIGNED NOT NULL DEFAULT 0,
    loyalty_credits_redeemed INT UNSIGNED NOT NULL DEFAULT 0,
    notes                 TEXT NULL,
    created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_orders_table         FOREIGN KEY (table_id)            REFERENCES tables_master(id),
    CONSTRAINT fk_orders_table_session FOREIGN KEY (table_session_id)    REFERENCES table_sessions(id),
    CONSTRAINT fk_orders_customer      FOREIGN KEY (customer_id)         REFERENCES customers(id),
    CONSTRAINT fk_orders_pos_session   FOREIGN KEY (pos_session_id)      REFERENCES pos_sessions(id),
    CONSTRAINT fk_orders_user          FOREIGN KEY (placed_by_user_id)   REFERENCES users(id),
    CONSTRAINT fk_orders_coupon        FOREIGN KEY (coupon_id)           REFERENCES coupons(id),
    CONSTRAINT chk_orders_totals CHECK (subtotal >= 0 AND tax_total >= 0 AND discount_total >= 0 AND total >= 0),
    CONSTRAINT chk_orders_source_user CHECK (
        (source = 'cashier'    AND placed_by_user_id IS NOT NULL)
        OR
        (source = 'self_order' AND placed_by_user_id IS NULL)
    )
);

ALTER TABLE stock_movements
    ADD CONSTRAINT fk_sm_order FOREIGN KEY (reference_order_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE loyalty_ledger
    ADD CONSTRAINT fk_loyalty_order FOREIGN KEY (order_id) REFERENCES orders(id);

CREATE TABLE order_items (
    id                    BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    order_id              INT UNSIGNED NOT NULL,
    product_id            INT UNSIGNED NOT NULL,
    quantity              DECIMAL(8,2) NOT NULL,
    unit_price            DECIMAL(10,2) NOT NULL,
    line_discount         DECIMAL(10,2) NOT NULL DEFAULT 0,
    line_total            DECIMAL(10,2) NOT NULL,
    kitchen_status        ENUM('to_cook','preparing','completed') NOT NULL DEFAULT 'to_cook',
    is_loyalty_redemption BOOLEAN NOT NULL DEFAULT FALSE,
    notes                 VARCHAR(255) NULL,
    CONSTRAINT fk_oi_order   FOREIGN KEY (order_id)   REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT chk_oi_qty   CHECK (quantity > 0),
    CONSTRAINT chk_oi_price CHECK (unit_price >= 0),
    CONSTRAINT chk_oi_line  CHECK (line_total >= 0),
    CONSTRAINT chk_oi_loyalty_free CHECK (is_loyalty_redemption = FALSE OR (unit_price = 0 AND line_total = 0))
);

CREATE TABLE payments (
    id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    order_id          INT UNSIGNED NOT NULL,
    payment_method_id TINYINT UNSIGNED NOT NULL,
    amount            DECIMAL(10,2) NOT NULL,
    amount_received   DECIMAL(10,2) NULL,
    change_due        DECIMAL(10,2) NULL,
    reference_code    VARCHAR(100) NULL,
    status            ENUM('pending','success','failed') NOT NULL DEFAULT 'pending',
    received_by       INT UNSIGNED NOT NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payments_order  FOREIGN KEY (order_id)          REFERENCES orders(id),
    CONSTRAINT fk_payments_method FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id),
    CONSTRAINT fk_payments_user   FOREIGN KEY (received_by)       REFERENCES users(id),
    CONSTRAINT chk_payments_amount CHECK (amount >= 0)
);

CREATE TABLE receipt_logs (
    id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    order_id        INT UNSIGNED NOT NULL,
    recipient_email VARCHAR(150) NOT NULL,
    sent_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivery_status ENUM('sent','failed','unknown') NOT NULL DEFAULT 'unknown',
    error_message   TEXT NULL,
    CONSTRAINT fk_receipt_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE audit_logs (
    id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id     INT UNSIGNED NULL,
    action      VARCHAR(60) NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id   INT UNSIGNED NOT NULL,
    details     JSON NULL,
    ip_address  VARCHAR(45) NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE venue_settings (
    id                        TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    venue_name                VARCHAR(100) NOT NULL DEFAULT 'Cafe POS',
    self_ordering_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    self_ordering_mode        ENUM('online_ordering','qr_menu') NOT NULL DEFAULT 'online_ordering',
    self_order_lock_mode      ENUM('device','pin') NOT NULL DEFAULT 'device',
    session_timeout_minutes   SMALLINT UNSIGNED NOT NULL DEFAULT 60,
    menu_background_color     CHAR(7) NOT NULL DEFAULT '#ffffff',
    menu_background_image_url VARCHAR(500) NULL,
    currency_symbol           VARCHAR(5) NOT NULL DEFAULT 'Rs.',
    tax_label                 VARCHAR(20) NOT NULL DEFAULT 'GST',
    receipt_footer_text       VARCHAR(255) NULL,
    kds_auto_advance          BOOLEAN NOT NULL DEFAULT FALSE,
    loyalty_enabled               BOOLEAN NOT NULL DEFAULT TRUE,
    loyalty_rupees_per_credit     INT UNSIGNED NOT NULL DEFAULT 100,
    loyalty_credits_for_reward    INT UNSIGNED NOT NULL DEFAULT 50,
    updated_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- SEED DATA
-- ---------------------------------------------------------------------
INSERT INTO roles (name) VALUES
    ('superadmin'), ('cashier'), ('inventory_manager');

INSERT INTO payment_methods (type, is_enabled, upi_id, display_name) VALUES
    ('cash',         TRUE,  NULL, 'Cash'),
    ('card_digital', TRUE,  NULL, 'Card / Digital'),
    ('upi',          FALSE, NULL, 'UPI QR');

INSERT INTO venue_settings (
    venue_name, self_ordering_enabled, self_ordering_mode,
    self_order_lock_mode, session_timeout_minutes,
    menu_background_color, currency_symbol, tax_label,
    loyalty_enabled, loyalty_rupees_per_credit, loyalty_credits_for_reward
) VALUES (
    'Cafe POS', TRUE, 'online_ordering',
    'device', 60,
    '#0f172a', 'Rs.', 'GST',
    TRUE, 100, 50
);

-- ---------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------
CREATE INDEX idx_orders_status           ON orders(status);
CREATE INDEX idx_orders_created_at       ON orders(created_at);
CREATE INDEX idx_orders_source           ON orders(source);
CREATE INDEX idx_order_items_kstatus     ON order_items(kitchen_status);
CREATE INDEX idx_order_items_order       ON order_items(order_id);
CREATE INDEX idx_products_category       ON products(category_id);
CREATE INDEX idx_products_active         ON products(is_active);
CREATE INDEX idx_stock_movements_item    ON stock_movements(inventory_item_id);
CREATE INDEX idx_stock_movements_type    ON stock_movements(movement_type);
CREATE INDEX idx_audit_entity            ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created           ON audit_logs(created_at);
CREATE INDEX idx_table_sessions_table    ON table_sessions(table_id);
CREATE INDEX idx_table_sessions_status   ON table_sessions(status);
CREATE INDEX idx_tables_qr_token         ON tables_master(qr_token);
CREATE INDEX idx_users_email             ON users(email);
CREATE INDEX idx_users_active            ON users(is_active);
CREATE INDEX idx_customers_mobile        ON customers(mobile_number);
CREATE INDEX idx_coupons_code            ON coupons(code);
CREATE INDEX idx_pos_sessions_user       ON pos_sessions(user_id);
CREATE INDEX idx_pos_sessions_status     ON pos_sessions(status);
CREATE INDEX idx_payments_order          ON payments(order_id);
CREATE INDEX idx_payments_status         ON payments(status);
CREATE INDEX idx_loyalty_customer        ON loyalty_ledger(customer_id);
CREATE INDEX idx_loyalty_order           ON loyalty_ledger(order_id);

-- =====================================================================
-- TRIGGERS
-- =====================================================================
DELIMITER //

-- ---------------------------------------------------------------------
-- TRIGGER 1: Deduct stock the MOMENT an order flips to 'sent_to_kitchen'.
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_orders_deduct_stock_on_send
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
    IF NEW.status = 'sent_to_kitchen' AND OLD.status <> 'sent_to_kitchen' THEN

        -- Decrement stock for every line item that has an inventory record.
        UPDATE inventory_items ii
        JOIN order_items oi ON oi.product_id = ii.product_id
        SET ii.current_stock = ii.current_stock - oi.quantity
        WHERE oi.order_id = NEW.id;

        -- Log a stock_movements row per affected item for full traceability.
        INSERT INTO stock_movements (inventory_item_id, movement_type, quantity, reference_order_id, performed_by, note)
        SELECT ii.id, 'sale_out', oi.quantity, NEW.id, NEW.placed_by_user_id,
               CONCAT('Auto-deducted on send-to-kitchen for order ', NEW.order_number)
        FROM order_items oi
        JOIN inventory_items ii ON ii.product_id = oi.product_id
        WHERE oi.order_id = NEW.id;

    END IF;
END//

-- ---------------------------------------------------------------------
-- TRIGGER 2: Earn loyalty credits the moment an order is marked 'paid'.
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_orders_earn_loyalty_on_paid
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
    DECLARE v_is_guest BOOLEAN;
    DECLARE v_credits_earned INT;
    DECLARE v_new_balance INT;

    IF NEW.status = 'paid' AND OLD.status <> 'paid' AND NEW.customer_id IS NOT NULL THEN

        SELECT is_guest INTO v_is_guest FROM customers WHERE id = NEW.customer_id;

        IF v_is_guest = FALSE THEN
            SET v_credits_earned = FLOOR(NEW.total / 100);

            IF v_credits_earned > 0 THEN
                UPDATE customers
                SET loyalty_credits = loyalty_credits + v_credits_earned
                WHERE id = NEW.customer_id;

                SELECT loyalty_credits INTO v_new_balance FROM customers WHERE id = NEW.customer_id;

                INSERT INTO loyalty_ledger (customer_id, order_id, entry_type, credits_delta, balance_after, note)
                VALUES (NEW.customer_id, NEW.id, 'earn', v_credits_earned, v_new_balance,
                        CONCAT('Earned on order ', NEW.order_number));

                UPDATE orders SET loyalty_credits_earned = v_credits_earned WHERE id = NEW.id;
            END IF;
        END IF;

    END IF;
END//

DELIMITER ;
