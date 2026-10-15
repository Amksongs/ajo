//! Typed contract events (#253). Topics and data layout match the original
//! `Events::publish` calls exactly — `(circle, <action>)` topics with the
//! circle id (or `[circle_id, address]`) as data — so existing decoders in
//! the SDK, CLI and frontend keep working unchanged.

use soroban_sdk::{contractevent, Address};

#[contractevent(topics = ["circle", "created"], data_format = "single-value")]
pub struct CircleCreated {
    pub circle_id: u64,
}

#[contractevent(topics = ["circle", "joined"], data_format = "single-value")]
pub struct CircleJoined {
    pub circle_id: u64,
}

#[contractevent(topics = ["circle", "left"], data_format = "single-value")]
pub struct CircleLeft {
    pub circle_id: u64,
}

#[contractevent(topics = ["circle", "cancel"], data_format = "single-value")]
pub struct CircleCancelled {
    pub circle_id: u64,
}

#[contractevent(topics = ["circle", "paid"], data_format = "vec")]
pub struct ContributionPaid {
    pub circle_id: u64,
    pub member: Address,
}

#[contractevent(topics = ["circle", "payout"], data_format = "vec")]
pub struct PayoutSent {
    pub circle_id: u64,
    pub recipient: Address,
}
