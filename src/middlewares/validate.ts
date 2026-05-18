import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiError } from '../utils/ApiError';

type ValidationSource = 'body' | 'query' | 'params';

export const validate = (schema: Joi.ObjectSchema, source: ValidationSource = 'body') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req[source], { abortEarly: false });

    if (error) {
      const errorMessage = error.details[0].message;
      next(new ApiError(400, errorMessage));
    } else {
      next();
    }
  };
};
