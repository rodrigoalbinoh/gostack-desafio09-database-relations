import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

interface IOrderProduct {
  product_id: string;
  price: number;
  quantity: number;
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found');
    }

    const productsIds = products.map(product => ({
      id: product.id,
    }));

    const findProducts = await this.productsRepository.findAllById(productsIds);

    const productsToUpdate: IProduct[] = [];
    const productsWithPrice: IOrderProduct[] = [];

    products.forEach(product => {
      const data = findProducts.find(
        productData => productData.id === product.id,
      );

      if (!data) {
        throw new AppError('Product not found');
      }

      if (product.quantity > data.quantity) {
        throw new AppError('Available stock is not sufficient');
      }

      productsToUpdate.push({
        id: product.id,
        quantity: data.quantity - product.quantity,
      });

      productsWithPrice.push({
        product_id: product.id,
        quantity: product.quantity,
        price: data.price,
      });
    });

    await this.productsRepository.updateQuantity(productsToUpdate);

    const order = await this.ordersRepository.create({
      customer,
      products: productsWithPrice,
    });

    return order;
  }
}

export default CreateOrderService;
