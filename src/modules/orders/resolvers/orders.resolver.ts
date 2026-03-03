import {
  Resolver,
  Mutation,
  Query,
  Args,
  Int,
  ResolveField,
  Parent,
  ID,
} from '@nestjs/graphql';
import { ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { OrderCheckoutService } from '../services/order-checkout.service';
import { OrderQueryService } from '../services/order-query.service';
import { OrderManagementService } from '../services/order-management.service';
import {
  Order,
  PaymentIntentResult,
  OrderItem,
  Payment,
  AssignmentResult,
} from '../entities/order.entity';
import { PaginatedOrders } from '../entities/paginated-orders.entity';
import { CheckoutInput } from '../dto/checkout.input';
import { OrderFilterInput } from '../dto/order-filter.input';
import { AssignAndShipInput } from '../dto/assign-and-ship.input';
import { OrderItemsDataLoader } from '../loaders/order-items.dataloader';
import { OrderPaymentsDataLoader } from '../loaders/order-payments.dataloader';
import { AbilitiesGuard } from '../../../common/casl/guards/abilities.guard';
import { CheckAbilities } from '../../../common/casl/decorators/check-abilities.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import {
  CaslAbilityFactory,
  Action,
} from '../../../common/casl/casl-ability.factory';
import { UserRole } from '@prisma/client';

@Resolver(() => Order)
export class OrdersResolver {
  constructor(
    private readonly orderCheckoutService: OrderCheckoutService,
    private readonly orderQueryService: OrderQueryService,
    private readonly orderManagementService: OrderManagementService,
    private readonly orderItemsLoader: OrderItemsDataLoader,
    private readonly orderPaymentsLoader: OrderPaymentsDataLoader,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  // ─────────────────────────────────────────────────
  // MUTATIONS
  // ─────────────────────────────────────────────────

  @Mutation(() => PaymentIntentResult, {
    description:
      'Create order from cart and return Stripe PaymentIntent client secret.',
  })
  @UseGuards(AbilitiesGuard)
  async checkout(
    @Args('input') input: CheckoutInput,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.orderCheckoutService.checkout(user.id, input);
  }

  @Mutation(() => Order, {
    description:
      'Manager marks a single PAID order as PROCESSING (packing stage).',
  })
  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Manage, subject: Order })
  async prepareOrder(
    @Args('orderId', { type: () => ID }, ParseUUIDPipe) orderId: string,
  ) {
    return this.orderManagementService.prepareOrder(orderId);
  }

  @Mutation(() => AssignmentResult, {
    description:
      'Manager assigns PROCESSING orders to a delivery person, moving them to SHIPPED status.',
  })
  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Manage, subject: Order })
  async assignAndShipOrders(@Args('input') input: AssignAndShipInput) {
    return this.orderManagementService.assignAndShipOrders(
      input.orderIds,
      input.deliveryPersonId,
    );
  }

  @Mutation(() => Order, {
    description:
      'Delivery person marks a single assigned SHIPPED order as DELIVERED.',
  })
  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Deliver, subject: Order })
  async markOrderAsDelivered(
    @Args('orderId', { type: () => ID }, ParseUUIDPipe) orderId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.orderManagementService.markAsDelivered(orderId, user.id);
  }

  @Mutation(() => Order, { description: 'Cancel an order.' })
  @UseGuards(AbilitiesGuard)
  @CheckAbilities({ action: Action.Cancel, subject: Order })
  async cancelOrder(
    @Args('id', { type: () => ID }, ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.orderManagementService.cancelOrder(id, user.id, user.role);
  }

  // ─────────────────────────────────────────────────
  // QUERIES
  // ─────────────────────────────────────────────────

  @Query(() => Order, { description: 'Get a specific order by ID.' })
  async order(
    @Args('id', { type: () => ID }, ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.orderQueryService.findOne(id, user.id, user.role);
  }

  @Query(() => PaginatedOrders, {
    description:
      'Get paginated orders. Clients see own, Managers see all, Delivery sees shipped assigned.',
  })
  async orders(
    @CurrentUser() user: { id: string; role: string },
    @Args('filter', { type: () => OrderFilterInput, nullable: true })
    filter?: OrderFilterInput,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit = 20,
    @Args('page', { type: () => Int, defaultValue: 1 }) page = 1,
  ) {
    return this.orderQueryService.findAll(
      user.id,
      user.role,
      filter,
      limit,
      page,
    );
  }

  // ─────────────────────────────────────────────────
  // RESOLVE FIELDS (DataLoaders)
  // ─────────────────────────────────────────────────

  @ResolveField(() => [OrderItem], {
    description: 'Lazy loads the items belonging to this order.',
  })
  async items(@Parent() order: Order) {
    return this.orderItemsLoader.load(order.id);
  }

  @ResolveField(() => [Payment], {
    description: 'Lazy loads the payments belonging to this order.',
  })
  async payments(
    @Parent() order: Order,
    @CurrentUser() user: { id: string; role: string },
  ) {
    // Delivery persons must not see payment details
    const ability = this.caslAbilityFactory.defineAbility({
      id: user.id,
      role: user.role as UserRole,
    });
    if (ability.cannot(Action.Read, Payment)) {
      return [];
    }
    return this.orderPaymentsLoader.load(order.id);
  }
}
