import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { CategoriesService } from '../../categories/categories.service';
import { Category } from '../../categories/entities/category.entity';

@Injectable({ scope: Scope.REQUEST })
export class CategoryDataLoader extends DataLoader<string, Category> {

  constructor(private readonly categoriesService: CategoriesService) {
    super((keys) => this.batchLoadFn(keys))
  }

  private async batchLoadFn(categoryIds: readonly string[]) {
    // fetch all in one query
    const categories = await this.categoriesService.findByIds([
      ...categoryIds,
    ]);
    const categoryMap = new Map(categories.map((cat) => [cat.id, cat]));
    
    //DataLoader requires either a value or Error
    return categoryIds.map((id) => {
      const category = categoryMap.get(id);
      return category ?? new Error(`Category with ID ${id} not found`);
    });
    
  }
}
