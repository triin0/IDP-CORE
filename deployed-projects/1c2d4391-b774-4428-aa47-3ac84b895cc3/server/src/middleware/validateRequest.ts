import { type Request, type Response, type NextFunction } from 'express';
import { type AnyZodObject, ZodError } from 'zod';

// Defines the shape of the schemas object that can be passed to the factory.
interface RequestSchemas {
  params?: AnyZodObject;
  body?: AnyZodObject;
  query?: AnyZodObject;
}

/**
 * Middleware factory for validating request data against Zod schemas.
 * @param schemas - An object containing Zod schemas for 'params', 'body', and/or 'query'.
 * @returns An Express middleware function.
 */
export const validateRequest = (schemas: RequestSchemas) => 
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate request params if a schema is provided
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }
      // Validate request body if a schema is provided
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      // Validate query string if a schema is provided
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }
      // If all validations pass, move to the next middleware
      next();
    } catch (error) {
      // If validation fails, pass the ZodError to the global error handler
      if (error instanceof ZodError) {
        next(error);
      } else {
        // Pass other errors along as well
        next(new Error('An unexpected error occurred during validation.'));
      }
    }
};
