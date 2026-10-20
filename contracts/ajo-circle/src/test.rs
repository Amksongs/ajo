#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::StellarAssetClient,
    Env,
};

fn setup(env: &Env) -> AjoCircleContractClient<'_> {
    env.mock_all_auths();
    let contract_id = env.register(AjoCircleContract, ());
    AjoCircleContractClient::new(env, &contract_id)
}

fn create_token<'a>(env: &Env) -> (Address, token::Client<'a>, StellarAssetClient<'a>) {
    let admin = Address::generate(env);
    let sac = env.register_stellar_asset_contract_v2(admin);
    let address = sac.address();
    (
        address.clone(),
        token::Client::new(env, &address),
        StellarAssetClient::new(env, &address),
    )
}

const WEEK: u64 = 604_800;

/// Two-member active circle where `a` has paid this cycle's contribution and
/// `b` has not. Returns the cycle-one deadline (`started_at + WEEK`).
fn active_circle_with_a_missing_contribution<'a>(
    env: &'a Env,
) -> (AjoCircleContractClient<'a>, u64, Address, Address, u64) {
    let client = setup(env);
    let (token, _, asset) = create_token(env);
    let a = Address::generate(env);
    let b = Address::generate(env);
    asset.mint(&a, &10_000);

    let id = client.create_circle(&a, &token, &1_000, &2, &WEEK);
    client.join_circle(&id, &b);
    let started_at = client.get_circle(&id).started_at;
    client.contribute(&id, &a);

    (client, id, a, b, started_at + WEEK)
}

#[test]
fn creates_a_circle_with_the_creator_as_first_member() {
    let env = Env::default();
    let client = setup(&env);
    let (token, _, _) = create_token(&env);
    let creator = Address::generate(&env);

    let id = client.create_circle(&creator, &token, &1_000, &3, &WEEK);
    assert_eq!(id, 1);

    let circle = client.get_circle(&id);
    assert_eq!(circle.members.len(), 1);
    assert_eq!(circle.members.get(0).unwrap(), creator);
    assert_eq!(circle.status, CircleStatus::Forming);
}

#[test]
fn rejects_invalid_circle_parameters() {
    let env = Env::default();
    let client = setup(&env);
    let (token, _, _) = create_token(&env);
    let creator = Address::generate(&env);

    assert_eq!(
        client.try_create_circle(&creator, &token, &0, &3, &WEEK),
        Err(Ok(ContractError::InvalidParams))
    );
    assert_eq!(
        client.try_create_circle(&creator, &token, &1_000, &1, &WEEK),
        Err(Ok(ContractError::InvalidParams))
    );
    assert_eq!(
        client.try_create_circle(&creator, &token, &1_000, &3, &0),
        Err(Ok(ContractError::InvalidParams))
    );
}

#[test]
fn rejects_cycle_length_above_max() {
    let env = Env::default();
    let client = setup(&env);
    let (token, _, _) = create_token(&env);
    let creator = Address::generate(&env);

    assert_eq!(
        client.try_create_circle(&creator, &token, &1_000, &3, &(MAX_CYCLE_LENGTH_SECS + 1)),
        Err(Ok(ContractError::InvalidParams))
    );
    assert_eq!(
        client.try_create_circle(&creator, &token, &1_000, &3, &u64::MAX),
        Err(Ok(ContractError::InvalidParams))
    );
}

#[test]
fn accepts_cycle_length_at_max() {
    let env = Env::default();
    let client = setup(&env);
    let (token, _, _) = create_token(&env);
    let creator = Address::generate(&env);

    let id = client.create_circle(&creator, &token, &1_000, &3, &MAX_CYCLE_LENGTH_SECS);
    assert_eq!(
        client.get_circle(&id).cycle_length_secs,
        MAX_CYCLE_LENGTH_SECS
    );
}

#[test]
fn circle_activates_once_full_and_locks_join_order_as_payout_order() {
    let env = Env::default();
    let client = setup(&env);
    let (token, _, _) = create_token(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let c = Address::generate(&env);

    let id = client.create_circle(&a, &token, &1_000, &3, &WEEK);
    let mid_circle = client.get_circle(&id);
    assert_eq!(mid_circle.status, CircleStatus::Forming);

    client.join_circle(&id, &b);
    client.join_circle(&id, &c);

    let circle = client.get_circle(&id);
    assert_eq!(circle.status, CircleStatus::Active);
    assert_eq!(circle.members.get(0).unwrap(), a);
    assert_eq!(circle.members.get(1).unwrap(), b);
    assert_eq!(circle.members.get(2).unwrap(), c);
    assert_eq!(circle.started_at, env.ledger().timestamp());
}

#[test]
fn rejects_joining_a_full_or_already_active_circle() {
    let env = Env::default();
    let client = setup(&env);
    let (token, _, _) = create_token(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let c = Address::generate(&env);
    let d = Address::generate(&env);

    let id = client.create_circle(&a, &token, &1_000, &2, &WEEK);
    client.join_circle(&id, &b);

    assert_eq!(
        client.try_join_circle(&id, &c),
        Err(Ok(ContractError::CircleNotForming))
    );
    let _ = d;
}

#[test]
fn rejects_joining_a_completed_circle() {
    let env = Env::default();
    let client = setup(&env);
    let (token, _, asset) = create_token(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    asset.mint(&a, &10_000);
    asset.mint(&b, &10_000);

    let id = client.create_circle(&a, &token, &1_000, &2, &WEEK);
    client.join_circle(&id, &b);

    // Drive a full rotation so the circle reaches Completed.
    for _ in 0..2 {
        client.contribute(&id, &a);
        client.contribute(&id, &b);
        client.disburse(&id);
    }
    assert_eq!(client.get_circle(&id).status, CircleStatus::Completed);

    // join_circle rejects any non-Forming status, so a fresh join on a
    // completed circle must still return CircleNotForming.
    let fresh = Address::generate(&env);
    assert_eq!(
        client.try_join_circle(&id, &fresh),
        Err(Ok(ContractError::CircleNotForming))
    );
}

#[test]
fn rejects_the_same_member_joining_twice() {
    let env = Env::default();
    let client = setup(&env);
    let (token, _, _) = create_token(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);

    let id = client.create_circle(&a, &token, &1_000, &3, &WEEK);

    assert_eq!(
        client.try_join_circle(&id, &a),
        Err(Ok(ContractError::AlreadyMember))
    );
    client.join_circle(&id, &b);
    assert_eq!(
        client.try_join_circle(&id, &b),
        Err(Ok(ContractError::AlreadyMember))
    );
}

#[test]
fn rejects_contributions_before_the_circle_is_active() {
    let env = Env::default();
    let client = setup(&env);
    let (token, _, _) = create_token(&env);
    let a = Address::generate(&env);

    let id = client.create_circle(&a, &token, &1_000, &3, &WEEK);

    assert_eq!(
        client.try_contribute(&id, &a),
        Err(Ok(ContractError::CircleNotActive))
    );
}

#[test]
fn rejects_contributions_from_non_members() {
    let env = Env::default();
    let client = setup(&env);
    let (token, _, asset) = create_token(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let outsider = Address::generate(&env);
    asset.mint(&a, &10_000);

    let id = client.create_circle(&a, &token, &1_000, &2, &WEEK);
    client.join_circle(&id, &b);

    assert_eq!(
        client.try_contribute(&id, &outsider),
        Err(Ok(ContractError::NotAMember))
    );
}

#[test]
fn full_cycle_pays_the_pot_to_the_first_member_and_advances() {
    let env = Env::default();
    let client = setup(&env);
    let (token, token_client, asset) = create_token(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    asset.mint(&a, &10_000);
    asset.mint(&b, &10_000);

    let id = client.create_circle(&a, &token, &1_000, &2, &WEEK);
    client.join_circle(&id, &b);

    assert_eq!(
        client.try_disburse(&id),
        Err(Ok(ContractError::CycleNotReady))
    );

    client.contribute(&id, &a);
    assert!(client.has_contributed(&id, &0, &a));
    assert!(!client.has_contributed(&id, &0, &b));

    client.contribute(&id, &b);
    assert_eq!(token_client.balance(&a), 9_000);
    assert_eq!(token_client.balance(&b), 9_000);

    let recipient = client.disburse(&id);
    assert_eq!(recipient, a);
    assert_eq!(token_client.balance(&a), 11_000);

    let circle = client.get_circle(&id);
    assert_eq!(circle.current_cycle, 1);
    assert_eq!(circle.status, CircleStatus::Active);
}

#[test]
fn rejects_contributing_twice_in_the_same_cycle() {
    let env = Env::default();
    let client = setup(&env);
    let (token, _, asset) = create_token(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    asset.mint(&a, &10_000);

    let id = client.create_circle(&a, &token, &1_000, &2, &WEEK);
    client.join_circle(&id, &b);

    client.contribute(&id, &a);
    assert_eq!(
        client.try_contribute(&id, &a),
        Err(Ok(ContractError::AlreadyContributed))
    );
}

#[test]
fn full_rotation_pays_every_member_exactly_once_and_completes() {
    let env = Env::default();
    let client = setup(&env);
    let (token, token_client, asset) = create_token(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let c = Address::generate(&env);
    for m in [&a, &b, &c] {
        asset.mint(m, &10_000);
    }

    let id = client.create_circle(&a, &token, &1_000, &3, &WEEK);
    client.join_circle(&id, &b);
    client.join_circle(&id, &c);

    for cycle in 0..3u32 {
        client.contribute(&id, &a);
        client.contribute(&id, &b);
        client.contribute(&id, &c);
        let expected_recipient = client.get_circle(&id).members.get(cycle).unwrap();
        let recipient = client.disburse(&id);
        assert_eq!(recipient, expected_recipient);
    }

    let circle = client.get_circle(&id);
    assert_eq!(circle.status, CircleStatus::Completed);
    assert_eq!(circle.current_cycle, 3);

    // Each member put in 3_000 and got exactly one 3_000 pot back.
    assert_eq!(token_client.balance(&a), 10_000);
    assert_eq!(token_client.balance(&b), 10_000);
    assert_eq!(token_client.balance(&c), 10_000);
}

#[test]
fn a_missed_deadline_still_pays_out_the_partial_pot_and_records_a_strike() {
    let env = Env::default();
    let client = setup(&env);
    let (token, token_client, asset) = create_token(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    asset.mint(&a, &10_000);
    asset.mint(&b, &10_000);

    let id = client.create_circle(&a, &token, &1_000, &2, &WEEK);
    client.join_circle(&id, &b);

    client.contribute(&id, &a);
    // b never contributes this cycle.

    env.ledger().with_mut(|l| l.timestamp += WEEK + 1);

    let recipient = client.disburse(&id);
    assert_eq!(recipient, a);
    // Only a's 1_000 made it into the pot.
    assert_eq!(token_client.balance(&a), 10_000);
    assert_eq!(client.missed_count(&id, &b), 1);

    let circle = client.get_circle(&id);
    assert_eq!(circle.current_cycle, 1);
}

#[test]
fn disburse_is_not_ready_just_before_the_cycle_deadline() {
    let env = Env::default();
    let (client, id, _, b, deadline) = active_circle_with_a_missing_contribution(&env);

    env.ledger().with_mut(|l| l.timestamp = deadline - 1);

    assert_eq!(
        client.try_disburse(&id),
        Err(Ok(ContractError::CycleNotReady))
    );
    assert_eq!(client.missed_count(&id, &b), 0);
}

#[test]
fn disburse_pays_out_at_the_cycle_deadline_and_records_a_strike() {
    let env = Env::default();
    let (client, id, a, b, deadline) = active_circle_with_a_missing_contribution(&env);

    // The deadline itself is inclusive: payout is allowed and the
    // non-contributor is struck.
    env.ledger().with_mut(|l| l.timestamp = deadline);

    assert_eq!(client.disburse(&id), a);
    assert_eq!(client.missed_count(&id, &b), 1);
}

#[test]
fn disburse_pays_out_after_the_cycle_deadline_and_records_a_strike() {
    let env = Env::default();
    let (client, id, a, b, deadline) = active_circle_with_a_missing_contribution(&env);

    env.ledger().with_mut(|l| l.timestamp = deadline + 1);

    assert_eq!(client.disburse(&id), a);
    assert_eq!(client.missed_count(&id, &b), 1);
}

#[test]
fn disburse_on_an_unknown_circle_fails() {
    let env = Env::default();
    let client = setup(&env);

    assert_eq!(
        client.try_disburse(&99),
        Err(Ok(ContractError::CircleNotFound))
    );
}

#[test]
fn mutations_on_an_unknown_circle_fail_with_circle_not_found() {
    let env = Env::default();
    let client = setup(&env);
    let caller = Address::generate(&env);

    assert_eq!(
        client.try_contribute(&99, &caller),
        Err(Ok(ContractError::CircleNotFound))
    );
    assert_eq!(
        client.try_leave_circle(&99, &caller),
        Err(Ok(ContractError::CircleNotFound))
    );
    assert_eq!(
        client.try_cancel_circle(&99, &caller),
        Err(Ok(ContractError::CircleNotFound))
    );
}

#[test]
fn total_circles_tracks_the_running_count() {
    let env = Env::default();
    let client = setup(&env);
    let (token, _, _) = create_token(&env);
    let a = Address::generate(&env);

    assert_eq!(client.total_circles(), 0);

    client.create_circle(&a, &token, &1_000, &2, &WEEK);
    assert_eq!(client.total_circles(), 1);

    client.create_circle(&a, &token, &2_000, &3, &WEEK);
    assert_eq!(client.total_circles(), 2);
}

#[test]
fn a_member_can_leave_a_forming_circle() {
    let env = Env::default();
    let client = setup(&env);
    let (token, _, _) = create_token(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let c = Address::generate(&env);

    let id = client.create_circle(&a, &token, &1_000, &4, &WEEK);
    client.join_circle(&id, &b);
    client.join_circle(&id, &c);

    client.leave_circle(&id, &b);

    let circle = client.get_circle(&id);
    assert_eq!(circle.members.len(), 2);
    assert_eq!(circle.members.get(0).unwrap(), a);
    assert_eq!(circle.members.get(1).unwrap(), c);
    assert_eq!(circle.status, CircleStatus::Forming);

    // The freed slot can be re-joined.
    client.join_circle(&id, &b);
    assert_eq!(client.get_circle(&id).members.len(), 3);
}

#[test]
fn rejects_leaving_a_circle_you_are_not_in_or_that_is_already_active() {
    let env = Env::default();
    let client = setup(&env);
    let (token, _, _) = create_token(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    let outsider = Address::generate(&env);

    let id = client.create_circle(&a, &token, &1_000, &2, &WEEK);

    assert_eq!(
        client.try_leave_circle(&id, &outsider),
        Err(Ok(ContractError::NotAMember))
    );

    client.join_circle(&id, &b); // circle fills and activates
    assert_eq!(
        client.try_leave_circle(&id, &a),
        Err(Ok(ContractError::CircleNotForming))
    );
}

#[test]
fn the_creator_can_cancel_a_forming_circle() {
    let env = Env::default();
    let client = setup(&env);
    let (token, _, _) = create_token(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);

    let id = client.create_circle(&a, &token, &1_000, &3, &WEEK);
    client.join_circle(&id, &b);

    client.cancel_circle(&id, &a);

    let circle = client.get_circle(&id);
    assert_eq!(circle.status, CircleStatus::Cancelled);

    // A cancelled circle can no longer be joined.
    let c = Address::generate(&env);
    assert_eq!(
        client.try_join_circle(&id, &c),
        Err(Ok(ContractError::CircleNotForming))
    );
}

#[test]
fn rejects_cancellation_by_a_non_creator_or_of_an_active_circle() {
    let env = Env::default();
    let client = setup(&env);
    let (token, _, _) = create_token(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);

    let id = client.create_circle(&a, &token, &1_000, &2, &WEEK);

    assert_eq!(
        client.try_cancel_circle(&id, &b),
        Err(Ok(ContractError::NotAuthorized))
    );

    client.join_circle(&id, &b); // circle fills and activates
    assert_eq!(
        client.try_cancel_circle(&id, &a),
        Err(Ok(ContractError::CircleNotForming))
    );
}

#[test]
fn disburse_fails_once_a_circle_is_completed_or_cancelled() {
    let env = Env::default();
    let client = setup(&env);
    let (token, _, asset) = create_token(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    asset.mint(&a, &10_000);
    asset.mint(&b, &10_000);

    // Completed: a 2-member circle finishes after both cycles pay out.
    let completed = client.create_circle(&a, &token, &1_000, &2, &WEEK);
    client.join_circle(&completed, &b);
    for _ in 0..2 {
        client.contribute(&completed, &a);
        client.contribute(&completed, &b);
        client.disburse(&completed);
    }
    assert_eq!(
        client.get_circle(&completed).status,
        CircleStatus::Completed
    );
    assert_eq!(
        client.try_disburse(&completed),
        Err(Ok(ContractError::CircleNotActive))
    );
    assert_eq!(
        client.try_contribute(&completed, &a),
        Err(Ok(ContractError::CircleNotActive))
    );

    // Cancelled: never activated, so disburse was never valid to begin with.
    let cancelled = client.create_circle(&a, &token, &1_000, &2, &WEEK);
    client.cancel_circle(&cancelled, &a);
    assert_eq!(
        client.get_circle(&cancelled).status,
        CircleStatus::Cancelled
    );
    assert_eq!(
        client.try_disburse(&cancelled),
        Err(Ok(ContractError::CircleNotActive))
    );
}

#[test]
fn missed_count_accumulates_across_multiple_missed_cycles() {
    let env = Env::default();
    let client = setup(&env);
    let (token, _, asset) = create_token(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    asset.mint(&a, &10_000);

    let id = client.create_circle(&a, &token, &1_000, &2, &WEEK);
    client.join_circle(&id, &b);

    // b misses two cycles in a row.
    client.contribute(&id, &a);
    env.ledger().with_mut(|l| l.timestamp += WEEK + 1);
    client.disburse(&id);
    assert_eq!(client.missed_count(&id, &b), 1);

    client.contribute(&id, &a);
    env.ledger().with_mut(|l| l.timestamp += WEEK + 1);
    client.disburse(&id);
    assert_eq!(client.missed_count(&id, &b), 2);
}

#[test]
fn read_queries_on_an_unknown_circle_or_member_return_defaults_not_errors() {
    let env = Env::default();
    let client = setup(&env);
    let stranger = Address::generate(&env);

    // has_contributed / missed_count check storage directly rather than
    // going through get_circle, so they don't fail on a circle id (or
    // member) that was never created — they just report "no, never" the
    // same way they would for a real member who simply hasn't acted yet.
    assert_eq!(client.has_contributed(&999, &0, &stranger), false);
    assert_eq!(client.missed_count(&999, &stranger), 0);

    assert_eq!(
        client.try_get_circle(&999),
        Err(Ok(ContractError::CircleNotFound))
    );
}

#[test]
fn full_rotation_scales_past_a_handful_of_members() {
    let env = Env::default();
    let client = setup(&env);
    let (token, token_client, asset) = create_token(&env);

    let mut members: soroban_sdk::Vec<Address> = soroban_sdk::Vec::new(&env);
    for _ in 0..10 {
        let m = Address::generate(&env);
        asset.mint(&m, &100_000);
        members.push_back(m);
    }

    let creator = members.get(0).unwrap();
    let id = client.create_circle(&creator, &token, &1_000, &10, &WEEK);
    for i in 1..members.len() {
        client.join_circle(&id, &members.get(i).unwrap());
    }
    assert_eq!(client.get_circle(&id).status, CircleStatus::Active);

    for cycle in 0..10u32 {
        for m in members.iter() {
            client.contribute(&id, &m);
        }
        let recipient = client.disburse(&id);
        assert_eq!(recipient, members.get(cycle).unwrap());
    }

    let circle = client.get_circle(&id);
    assert_eq!(circle.status, CircleStatus::Completed);
    // Each of the 10 members put in 10_000 total and got exactly one
    // 10_000 pot back.
    for m in members.iter() {
        assert_eq!(token_client.balance(&m), 100_000);
    }
}

#[test]
fn an_empty_forming_circle_can_be_rejoined_and_only_creator_still_member_can_cancel() {
    let env = Env::default();
    let client = setup(&env);
    let (token, _, _) = create_token(&env);
    let creator = Address::generate(&env);
    let member = Address::generate(&env);
    let outsider = Address::generate(&env);

    let id = client.create_circle(&creator, &token, &1_000, &3, &WEEK);
    client.join_circle(&id, &member);
    client.leave_circle(&id, &member);
    client.leave_circle(&id, &creator);

    let circle = client.get_circle(&id);
    assert_eq!(circle.status, CircleStatus::Forming);
    assert!(circle.members.is_empty());

    client.join_circle(&id, &outsider);
    assert_eq!(client.get_circle(&id).members.len(), 1);
    assert_eq!(client.get_circle(&id).members.get(0).unwrap(), outsider);

    assert_eq!(
        client.try_cancel_circle(&id, &outsider),
        Err(Ok(ContractError::NotAuthorized))
    );
}

#[test]
fn creator_who_left_cannot_cancel_the_circle() {
    // #103: leaving gives up the creator's cancel right.
    let env = Env::default();
    let client = setup(&env);
    let (token, _, _) = create_token(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);

    let id = client.create_circle(&a, &token, &1_000, &3, &WEEK);
    client.join_circle(&id, &b);
    client.leave_circle(&id, &a);

    assert_eq!(
        client.try_cancel_circle(&id, &a),
        Err(Ok(ContractError::NotAuthorized))
    );
    // Still Forming, and the remaining member can still leave on their own.
    assert_eq!(client.get_circle(&id).status, CircleStatus::Forming);
    client.leave_circle(&id, &b);
    assert!(client.get_circle(&id).members.is_empty());
}

#[test]
fn rejects_contribution_whose_full_pot_overflows() {
    let env = Env::default();
    let client = setup(&env);
    let (token, _, _) = create_token(&env);
    let creator = Address::generate(&env);

    // i128::MAX / 2 with three members would overflow disburse's pot (#243).
    assert_eq!(
        client.try_create_circle(&creator, &token, &(i128::MAX / 2), &3, &WEEK),
        Err(Ok(ContractError::InvalidParams))
    );
    assert!(client
        .try_create_circle(&creator, &token, &(i128::MAX / 3), &3, &WEEK)
        .is_ok());
}

/// #253 — the `#[contractevent]` types must keep the exact wire shape the old
/// `Events::publish` calls produced (`(circle, <action>)` topics, circle id as
/// a bare u64), or the SDK/CLI/frontend event decoders break.
#[test]
fn typed_events_keep_the_legacy_topic_and_data_shape() {
    use soroban_sdk::testutils::Events as _;
    use soroban_sdk::xdr::{ContractEventBody, ScSymbol, ScVal, StringM};

    let env = Env::default();
    let client = setup(&env);
    let (token, _, _) = create_token(&env);
    let creator = Address::generate(&env);

    let id = client.create_circle(&creator, &token, &1_000, &3, &WEEK);

    let events = env.events().all().filter_by_contract(&client.address);
    let event = events
        .events()
        .last()
        .expect("create_circle emits an event");
    let ContractEventBody::V0(body) = &event.body;
    let sym = |s: &str| ScVal::Symbol(ScSymbol(StringM::try_from(s).unwrap()));
    assert_eq!(body.topics.as_slice(), &[sym("circle"), sym("created")]);
    assert_eq!(body.data, ScVal::U64(id));
}
