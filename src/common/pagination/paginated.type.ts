import { Type } from '@nestjs/common';
import { Field, Int, ObjectType } from '@nestjs/graphql';

//in services and resolvers for full TypeScript type-safety
export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Factory that creates a runtime GraphQL ObjectType for paginated results.
 * Since TypeScript generics are erased at compile time, we pass a real class
 * reference so NestJS can correctly generate the `items` type in the schema.
 */
export function Paginated<T>(classRef: Type<T>): Type<PaginatedResult<T>> {
  @ObjectType({ isAbstract: true })
  abstract class PaginatedType implements PaginatedResult<T> {
    @Field(() => [classRef])
    items: T[];

    @Field(() => Int)
    page: number;

    @Field(() => Int)
    limit: number;

    @Field(() => Int)
    totalItems: number;

    @Field(() => Int)
    totalPages: number;

    @Field(() => Boolean)
    hasNextPage: boolean;

    @Field(() => Boolean)
    hasPreviousPage: boolean;
  }

  // NestJS uses the class name to register types in its metadata registry.
  // Without a unique name, every call to Paginated() would register the same
  // "PaginatedType" key, and the schema builder would fail to resolve `items`.
  Object.defineProperty(PaginatedType, 'name', {
    value: `Paginated${classRef.name}`,
  });

  return PaginatedType as Type<PaginatedResult<T>>;
}
