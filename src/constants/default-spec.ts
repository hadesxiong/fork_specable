export const DEFAULT_SPEC = `openapi: 3.0.3
info:
  title: Bookstore API
  description: |
    A sample API for managing a bookstore inventory.

    ## Features demonstrated
    - Multiple servers for different environments
    - Authentication (Bearer token, API key)
    - CRUD operations with various HTTP methods
    - Schema relationships (\`$ref\`, \`allOf\`, \`oneOf\`)
    - Path, query, and header parameters
    - Request/response validation
  version: 1.0.0
  contact:
    name: API Support
    email: support@example.com

servers:
  - url: https://api.bookstore.example.com/v1
    description: Production
  - url: https://staging-api.bookstore.example.com/v1
    description: Staging
  - url: http://localhost:3000/v1
    description: Local development

tags:
  - name: Books
    description: Book inventory management
  - name: Authors
    description: Author information
  - name: Orders
    description: Customer orders

security:
  - bearerAuth: []
  - apiKey: []

paths:
  /books:
    get:
      tags: [Books]
      summary: List books
      description: Retrieve a paginated list of books with optional filtering.
      operationId: listBooks
      parameters:
        - name: limit
          in: query
          description: Maximum number of books to return
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
        - name: offset
          in: query
          description: Number of books to skip
          schema:
            type: integer
            minimum: 0
            default: 0
        - name: genre
          in: query
          description: Filter by genre
          schema:
            $ref: '#/components/schemas/Genre'
        - name: X-Request-ID
          in: header
          description: Optional request tracking ID
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: List of books
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Book'
                  pagination:
                    $ref: '#/components/schemas/Pagination'
        '401':
          $ref: '#/components/responses/Unauthorized'

    post:
      tags: [Books]
      summary: Create a book
      description: Add a new book to the inventory.
      operationId: createBook
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BookInput'
      responses:
        '201':
          description: Book created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Book'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /books/{bookId}:
    parameters:
      - $ref: '#/components/parameters/BookId'

    get:
      tags: [Books]
      summary: Get a book
      description: Retrieve details of a specific book.
      operationId: getBook
      responses:
        '200':
          description: Book details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Book'
        '404':
          $ref: '#/components/responses/NotFound'

    put:
      tags: [Books]
      summary: Update a book
      operationId: updateBook
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BookInput'
      responses:
        '200':
          description: Book updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Book'
        '404':
          $ref: '#/components/responses/NotFound'

    delete:
      tags: [Books]
      summary: Delete a book
      operationId: deleteBook
      responses:
        '204':
          description: Book deleted
        '404':
          $ref: '#/components/responses/NotFound'

  /authors:
    get:
      tags: [Authors]
      summary: List authors
      operationId: listAuthors
      responses:
        '200':
          description: List of authors
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Author'

  /authors/{authorId}:
    get:
      tags: [Authors]
      summary: Get an author
      operationId: getAuthor
      parameters:
        - name: authorId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Author details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Author'

  /orders:
    post:
      tags: [Orders]
      summary: Place an order
      operationId: createOrder
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/OrderInput'
      responses:
        '201':
          description: Order placed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    apiKey:
      type: apiKey
      in: header
      name: X-API-Key

  parameters:
    BookId:
      name: bookId
      in: path
      required: true
      description: Unique book identifier
      schema:
        type: string
        format: uuid

  responses:
    BadRequest:
      description: Invalid request
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    Unauthorized:
      description: Authentication required
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

  schemas:
    Book:
      allOf:
        - $ref: '#/components/schemas/BookInput'
        - type: object
          required: [id, createdAt]
          properties:
            id:
              type: string
              format: uuid
              description: Unique identifier assigned to the book on creation
            createdAt:
              type: string
              format: date-time
              description: Timestamp when the book record was created
            updatedAt:
              type: string
              format: date-time
              description: Timestamp when the book record was last modified

    BookInput:
      type: object
      required: [title, authorId, genre, price]
      properties:
        title:
          type: string
          minLength: 1
          maxLength: 200
          description: Full title of the book
          example: The Great Gatsby
        authorId:
          type: string
          format: uuid
          description: Reference to the author of the book
        genre:
          description: Literary genre classification
          $ref: '#/components/schemas/Genre'
        price:
          description: Retail price of the book
          $ref: '#/components/schemas/Money'
        isbn:
          type: string
          pattern: ^\\d{13}$
          description: 13-digit International Standard Book Number (ISBN-13)
        publishedDate:
          type: string
          format: date
          description: Date the book was first published
        description:
          type: string
          description: Brief summary or blurb about the book

    Author:
      type: object
      required: [id, name]
      properties:
        id:
          type: string
          format: uuid
          description: Unique identifier for the author
        name:
          type: string
          description: Full name of the author
        biography:
          type: string
          description: Short biographical note about the author
        books:
          type: array
          description: List of books written by this author
          items:
            $ref: '#/components/schemas/Book'

    Genre:
      type: string
      description: Literary genre used to classify books in the inventory
      enum: [fiction, non-fiction, mystery, sci-fi, fantasy, biography, history]

    Money:
      type: object
      description: Monetary value with currency
      required: [amount, currency]
      properties:
        amount:
          type: number
          minimum: 0
          description: Decimal monetary amount
          example: 19.99
        currency:
          type: string
          enum: [USD, EUR, GBP]
          default: USD
          description: ISO 4217 currency code

    OrderInput:
      type: object
      required: [items]
      properties:
        items:
          type: array
          minItems: 1
          description: List of books and quantities to order
          items:
            $ref: '#/components/schemas/OrderItem'
        shippingAddress:
          description: Delivery address for the order
          $ref: '#/components/schemas/Address'

    OrderItem:
      type: object
      required: [bookId, quantity]
      properties:
        bookId:
          type: string
          format: uuid
          description: Identifier of the book being ordered
        quantity:
          type: integer
          minimum: 1
          description: Number of copies to order

    Order:
      type: object
      required: [id, status, items, total]
      properties:
        id:
          type: string
          format: uuid
          description: Unique identifier for the order
        status:
          type: string
          enum: [pending, confirmed, shipped, delivered, cancelled]
          description: Current fulfilment status of the order
        items:
          type: array
          description: Line items included in the order
          items:
            $ref: '#/components/schemas/OrderItem'
        total:
          description: Total cost of the order including all items
          $ref: '#/components/schemas/Money'
        shippingAddress:
          description: Delivery address for the order
          $ref: '#/components/schemas/Address'
        createdAt:
          type: string
          format: date-time
          description: Timestamp when the order was placed

    Address:
      type: object
      description: Physical mailing address
      required: [street, city, country]
      properties:
        street:
          type: string
          description: Street name and number
        city:
          type: string
          description: City or town name
        postcode:
          type: string
          description: Postal or ZIP code
        country:
          type: string
          description: ISO 3166-1 country name or code

    Pagination:
      type: object
      description: Metadata for paginated list responses
      properties:
        total:
          type: integer
          description: Total number of records available
        limit:
          type: integer
          description: Maximum number of records returned per page
        offset:
          type: integer
          description: Number of records skipped from the start
        hasMore:
          type: boolean
          description: Whether additional pages of results exist

    Error:
      type: object
      description: Standard error response returned for failed requests
      required: [code, message]
      properties:
        code:
          type: string
          description: Machine-readable error code
        message:
          type: string
          description: Human-readable error message
        details:
          type: array
          description: Field-level validation errors, if applicable
          items:
            type: object
            properties:
              field:
                type: string
                description: Path to the field that caused the error
              reason:
                type: string
                description: Explanation of why the field is invalid
`
