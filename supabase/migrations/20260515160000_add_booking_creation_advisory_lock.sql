create or replace function public.create_booking_order_after_payment_v1(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_car_id bigint;
  v_auth_user_id uuid;
  v_requested_by text;
  v_reservation_code text;
  v_payment_provider text;
  v_payment_reference_id text;
  v_booking_status text;
  v_payment_status text;
  v_customer_name text;
  v_customer_phone text;
  v_customer_phone_last4 text;
  v_customer_birth text;
  v_customer_birth_last4 text;
  v_lookup_phone_hash text;
  v_lookup_birth_hash text;
  v_pickup_at timestamptz;
  v_return_at timestamptz;
  v_pickup_method text;
  v_quoted_total_amount numeric(12, 2);
  v_rental_amount numeric;
  v_insurance_amount numeric;
  v_delivery_amount numeric;
  v_final_amount numeric;
  v_payment_method text;
  v_pickup_location_snapshot jsonb;
  v_return_location_snapshot jsonb;
  v_car public.cars%rowtype;
  v_existing_order public.booking_orders%rowtype;
  v_created_order public.booking_orders%rowtype;
  v_booking_conflicts integer;
  v_ims_conflicts integer;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    return jsonb_build_object('ok', false, 'status', 400, 'code', 'invalid_payload', 'message', '예약 생성 payload가 올바르지 않습니다.');
  end if;

  v_source_car_id := nullif(btrim(payload->>'source_car_id'), '')::bigint;
  v_requested_by := coalesce(nullif(btrim(payload->>'requested_by'), ''), 'guest');
  v_reservation_code := upper(nullif(btrim(payload->>'public_reservation_code'), ''));
  v_payment_provider := nullif(btrim(payload->>'payment_provider'), '');
  v_payment_reference_id := nullif(btrim(payload->>'payment_reference_id'), '');
  v_booking_status := coalesce(nullif(btrim(payload->>'booking_status'), ''), 'confirmed');
  v_payment_status := coalesce(nullif(btrim(payload->>'payment_status'), ''), 'paid');
  v_customer_name := nullif(btrim(payload->>'customer_name'), '');
  v_customer_phone := nullif(btrim(payload->>'customer_phone'), '');
  v_customer_phone_last4 := nullif(btrim(payload->>'customer_phone_last4'), '');
  v_customer_birth := nullif(btrim(payload->>'customer_birth'), '');
  v_customer_birth_last4 := nullif(btrim(payload->>'customer_birth_last4'), '');
  v_lookup_phone_hash := nullif(btrim(payload->>'lookup_phone_hash'), '');
  v_lookup_birth_hash := nullif(btrim(payload->>'lookup_birth_hash'), '');
  v_pickup_at := nullif(btrim(payload->>'pickup_at'), '')::timestamptz;
  v_return_at := nullif(btrim(payload->>'return_at'), '')::timestamptz;
  v_pickup_method := nullif(btrim(payload->>'pickup_method'), '');
  v_quoted_total_amount := coalesce(nullif(btrim(payload->>'quoted_total_amount'), '')::numeric, -1);
  v_rental_amount := nullif(btrim(payload->>'rental_amount'), '')::numeric;
  v_insurance_amount := nullif(btrim(payload->>'insurance_amount'), '')::numeric;
  v_delivery_amount := nullif(btrim(payload->>'delivery_amount'), '')::numeric;
  v_final_amount := nullif(btrim(payload->>'final_amount'), '')::numeric;
  v_payment_method := nullif(btrim(payload->>'payment_method'), '');
  v_pickup_location_snapshot := coalesce(payload->'pickup_location_snapshot', '{}'::jsonb);
  v_return_location_snapshot := coalesce(payload->'return_location_snapshot', '{}'::jsonb);

  if nullif(btrim(payload->>'auth_user_id'), '') is not null then
    if (payload->>'auth_user_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return jsonb_build_object('ok', false, 'status', 400, 'code', 'invalid_payload', 'message', '예약 사용자 식별자가 올바르지 않습니다.');
    end if;
    v_auth_user_id := (payload->>'auth_user_id')::uuid;
  end if;

  if v_source_car_id is null
    or v_reservation_code is null
    or v_payment_provider is null
    or v_payment_reference_id is null
    or v_customer_name is null
    or v_customer_phone is null
    or v_customer_phone_last4 is null
    or v_customer_birth is null
    or v_customer_birth_last4 is null
    or v_lookup_phone_hash is null
    or v_lookup_birth_hash is null
    or v_pickup_at is null
    or v_return_at is null
    or v_pickup_method is null then
    return jsonb_build_object('ok', false, 'status', 400, 'code', 'invalid_payload', 'message', '예약 생성 필수값이 누락되었습니다.');
  end if;

  if v_pickup_at >= v_return_at then
    return jsonb_build_object('ok', false, 'status', 400, 'code', 'invalid_booking_period', 'message', '예약 기간이 올바르지 않습니다.');
  end if;

  if v_payment_provider not in ('nhn_kcp', 'surrogate_web') then
    return jsonb_build_object('ok', false, 'status', 400, 'code', 'invalid_payment_provider', 'message', '결제 제공자 정보가 올바르지 않습니다.');
  end if;

  if v_payment_reference_id !~ '^[A-Za-z0-9._:-]+$' then
    return jsonb_build_object('ok', false, 'status', 400, 'code', 'invalid_payment_reference_id', 'message', '결제 거래번호가 올바르지 않습니다.');
  end if;

  if v_booking_status not in ('confirmed', 'cancelled') then
    return jsonb_build_object('ok', false, 'status', 400, 'code', 'invalid_booking_status', 'message', '예약 상태가 올바르지 않습니다.');
  end if;

  if v_payment_status not in ('paid', 'refund_pending', 'refunded') then
    return jsonb_build_object('ok', false, 'status', 400, 'code', 'invalid_payment_status', 'message', '결제 상태가 올바르지 않습니다.');
  end if;

  if v_pickup_method not in ('pickup', 'delivery') then
    return jsonb_build_object('ok', false, 'status', 400, 'code', 'invalid_pickup_method', 'message', '수령 방식이 올바르지 않습니다.');
  end if;

  if v_quoted_total_amount < 0 then
    return jsonb_build_object('ok', false, 'status', 400, 'code', 'invalid_payment_amount', 'message', '예약 금액이 올바르지 않습니다.');
  end if;

  if char_length(v_customer_phone_last4) <> 4 or right(v_customer_phone, 4) <> v_customer_phone_last4 then
    return jsonb_build_object('ok', false, 'status', 400, 'code', 'invalid_customer_phone_last4', 'message', '고객 연락처 정보가 올바르지 않습니다.');
  end if;

  if char_length(v_customer_birth_last4) <> 4 or right(v_customer_birth, 4) <> v_customer_birth_last4 then
    return jsonb_build_object('ok', false, 'status', 400, 'code', 'invalid_customer_birth_last4', 'message', '고객 생년월일 정보가 올바르지 않습니다.');
  end if;

  select *
    into v_car
  from public.cars
  where source_car_id = v_source_car_id
    and active = true
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'status', 404, 'code', 'car_not_found', 'message', '예약 차량 정보를 찾을 수 없습니다.');
  end if;

  select *
    into v_existing_order
  from public.booking_orders
  where payment_provider = v_payment_provider
    and payment_reference_id = v_payment_reference_id
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'status', 200,
      'deduped', true,
      'booking_order', to_jsonb(v_existing_order)
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('rentcar00:booking:car:' || v_car.id::text, 0)
  );

  select count(*)
    into v_booking_conflicts
  from public.booking_orders
  where car_id = v_car.id
    and booking_status = 'confirmed'
    and pickup_at < v_return_at
    and return_at > v_pickup_at;

  select count(*)
    into v_ims_conflicts
  from public.ims_sync_reservations
  where car_id = v_car.source_car_id::text
    and start_at < v_return_at
    and end_at > v_pickup_at;

  if v_booking_conflicts > 0 or v_ims_conflicts > 0 then
    return jsonb_build_object(
      'ok', false,
      'status', 409,
      'code', 'booking_unavailable',
      'message', '방금 다른 예약과 겹쳐 해당 차량 예약이 불가합니다. 다시 검색해 주세요.',
      'conflicts', jsonb_build_object('bookingOrders', v_booking_conflicts, 'imsReservations', v_ims_conflicts)
    );
  end if;

  begin
    insert into public.booking_orders (
      public_reservation_code,
      booking_channel,
      customer_name,
      customer_phone,
      customer_phone_last4,
      user_id,
      car_id,
      pickup_at,
      return_at,
      pickup_method,
      pickup_location_snapshot,
      return_location_snapshot,
      quoted_total_amount,
      pricing_snapshot,
      payment_provider,
      payment_reference_id,
      booking_status,
      payment_status,
      sync_status,
      manual_review_required
    ) values (
      v_reservation_code,
      'website',
      v_customer_name,
      v_customer_phone,
      v_customer_phone_last4,
      v_auth_user_id,
      v_car.id,
      v_pickup_at,
      v_return_at,
      v_pickup_method,
      v_pickup_location_snapshot,
      v_return_location_snapshot,
      v_quoted_total_amount,
      jsonb_build_object(
        'carName', coalesce(v_car.display_name, v_car.name, ''),
        'carNumber', coalesce(v_car.car_number, ''),
        'quotedTotalAmount', v_quoted_total_amount,
        'rentalAmount', v_rental_amount,
        'insuranceAmount', v_insurance_amount,
        'deliveryAmount', v_delivery_amount,
        'finalAmount', v_final_amount,
        'paymentMethod', v_payment_method,
        'customerBirth', v_customer_birth
      ),
      v_payment_provider,
      v_payment_reference_id,
      v_booking_status,
      v_payment_status,
      'not_required',
      false
    )
    returning * into v_created_order;

    insert into public.booking_lookup_keys (
      booking_order_id,
      lookup_type,
      lookup_value_hash,
      lookup_value_last4,
      verified_at
    ) values
      (v_created_order.id, 'customer_phone', v_lookup_phone_hash, v_customer_phone_last4, now()),
      (v_created_order.id, 'customer_birth', v_lookup_birth_hash, v_customer_birth_last4, now());

    insert into public.reservation_status_events (
      booking_order_id,
      event_type,
      event_payload
    ) values (
      v_created_order.id,
      'booking_created',
      jsonb_build_object(
        'requestedBy', v_requested_by,
        'authUserId', v_auth_user_id,
        'bookingChannel', 'website',
        'paymentProvider', v_payment_provider,
        'paymentReferenceId', v_payment_reference_id,
        'bookingStatus', v_booking_status,
        'paymentStatus', v_payment_status,
        'syncStatus', 'not_required'
      )
    );
  exception
    when unique_violation then
      select *
        into v_existing_order
      from public.booking_orders
      where payment_provider = v_payment_provider
        and payment_reference_id = v_payment_reference_id
      order by created_at desc
      limit 1;

      if found then
        return jsonb_build_object(
          'ok', true,
          'status', 200,
          'deduped', true,
          'booking_order', to_jsonb(v_existing_order)
        );
      end if;

      return jsonb_build_object('ok', false, 'status', 409, 'code', 'booking_insert_failed', 'message', '예약 생성 중 중복 제약 오류가 발생했습니다.');
    when others then
      return jsonb_build_object('ok', false, 'status', 500, 'code', 'booking_transaction_failed', 'message', '예약 생성 저장 중 오류가 발생했습니다.');
  end;

  return jsonb_build_object(
    'ok', true,
    'status', 201,
    'deduped', false,
    'booking_order', to_jsonb(v_created_order)
  );
exception
  when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
    return jsonb_build_object('ok', false, 'status', 400, 'code', 'invalid_payload', 'message', '예약 생성 payload 형식이 올바르지 않습니다.');
end;
$$;
