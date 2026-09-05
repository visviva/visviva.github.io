+++
title = "From Filter Strings to LINQ (Part I)"
description = "Build a lexer, parser, and binder that turns user-defined filter strings into LINQ expression trees for dynamic queries."
date = "2026-09-05"
draft = true
tags = ["c#", "parser", "linq"]
math = true
+++

## Preface

It actually goes back to a problem I had at my job. We use a system modeling software to define data
types for typical middleware stuff like transporation of data between different applications. There
we had the goal to have some kind of validation engine to assert policies on the sent/received data
types.

Actually this is not different at all to this LINQ expression parser/binder. In the end problems
like these always feel like some kind of hidden
[SAT solver](https://en.wikipedia.org/wiki/SAT_solver).

I never came to finish this project at my job and it also never left my brain. I hope this helps me
to get rid of it at all. Therefore I changed to problem itself and tried to solve it in C#.

## The Problem

Imagine we are building an application that exposes products:

```csharp {title="Product Definition"}
record Product(
    string Name,
    string Category,
    decimal Price,
    bool InStock);
```

At some point, someone will filter for properties and this is pretty easy:

```csharp {title="Typical Filtering"}
var products = db.Products
    .Where(p => p.Price > 100 && p.InStock);
```

But some product management guy definitly will come with such a requirement:

> Users shall be able to define their own filters at runtime.

Especiall when we're building an admin dashboard, reporting system, all kind of automation stuff or
of course a search feature.

We then want users to be able to express:

{{< note >}}I use python for syntax highlighting of our small language. This is not python. Maybe it
works by accident.{{< /note >}}

```python {title="User Query"}
price > 100 and inStock == true
```

The very important constraint is that we do not know this condition when we compile the application.
So we somehow need to turn

```python {title="User Query"}
price > 100 and inStock == true
```

into something like:

```csharp {title="Transformed User Query"}
p => p.Price > 100 && p.InStock == true
```

And to make this work with LINQ, we want the result to be of type:

```csharp {title="Filter Type"}
Expression<Func<Product, bool>>
```

so that we can pass it into

```csharp {title="LINQ Query"}
db.Products.Where(predicate);
```

This is our problem!

## The obvious solution

This problem actually sounds very normal and I bet millions of developers already solved it. Maybe
there are common patterns or each one solved it differently, I don't know. But the straightforward
way to solve this, is to initially come up with something like:

```csharp {title="Product Filter Type"}
record ProductFilter(
    decimal? MinimumPrice,
    decimal? MaximumPrice,
    string? Category,
    bool? InStock);
```

Then we can construct a query:

```csharp {title="Query Definition"}
IQueryable<Product> ApplyFilter(
    IQueryable<Product> query,
    ProductFilter filter)
{
    if (filter.MinimumPrice is not null)
        query = query.Where(p => p.Price >= filter.MinimumPrice);

    if (filter.MaximumPrice is not null)
        query = query.Where(p => p.Price <= filter.MaximumPrice);

    if (filter.Category is not null)
        query = query.Where(p => p.Category == filter.Category);

    if (filter.InStock is not null)
        query = query.Where(p => p.InStock == filter.InStock);

    return query;
}
```

I guess for most applications this is exactly the correct solution. No need for a language when four
optional properties can solve your problem.

But as always, requirements grew. At first users want:

```python {title="Simple Query"}
price > 100 and category == "Books"
```

and then they want:

```python {title="More complex Query"}
price > 100 and category == "Books"
```

and everything still fine but then:

```python {title="Breaking Query"}
(price < 20 or price > 100) and inStock == true
```

The simple filter object are breaking apart. The users aren't just specifying values anymore, they
are now specifying logic. This is a transition point.

## A possible solution: Build the Expression dynamically

{{< note >}}Does this already qualify to be a
[homoiconic](https://en.wikipedia.org/wiki/Homoiconicity) language?{{< /note >}}But still, not a
problem, we are not the first having this problem. Now little bit more complicated but C# allows us
to represent code as data through expression trees.

Instead of:

```csharp {title="Simple predicate"}
p => p.Price > 100
```

we can also construct this:

```csharp {title="Predicate Construction"}
var parameter = Expression.Parameter(
    typeof(Product),
    "p");

var property = Expression.Property(
    parameter,
    nameof(Product.Price));

var comparison = Expression.GreaterThan(
    property,
    value);

var value = Expression.Constant(100m);

var predicate =
    Expression.Lambda<Func<Product, bool>>(
        comparison,
        parameter);
```

And we also get:

```csharp {title="Result Type of Predicate Construction"}
Expression<Func<Product, bool>>
```

Very nice, so what we do is split the query into three parts:

```text
price
>
100
```

and create corresponding expression tree. For this example it works.

But now our user specifies the query from above:

```python {title="User Query"}
price > 100 and inStock == true
```

Okay, perhaps we split on `and`. But what do we do on:

```python {title="Breaking Query"}
(price < 20 or price > 100) and inStock == true
```

Splitting string (suddenly) starts to look suspicious.

## Accidental Invention of a Language

Our users are writing:

```python
price > 100 and (category == "Books" or category == "Games")
```

That isn't merely a string. It has syntax.

It has literals:

```python
100
"Books"
true
```

Identifiers:

```python
price
category
inStock
```

Operators:

```python
>
==
and
or
```

And grouping:

```python
(...)
```

More importantly, it has rules.

For example:

```python
price > 100 and inStock == true
```

means:

```python
(price > 100) and (inStock == true)
```

Our application needs to understand that structure before it can generate an expression tree.

**We don't have a string-processing problem. We have a parsing problem.**

## The Actual Solution

{{< note >}}If you are interested in this topic, checkout
[crafting interpreters](https://craftinginterpreters.com/) from Robert Nystrom. It is by far one of
the best books about how to build lexers, parser and interpreters. {{< /note >}} The architecture
now emerges naturally. We are going to build a tiny query language. To do this, we will implement
the following pipeline.

<!-- prettier-ignore -->
![Pipeline](/diagrams/expression-linq-binder/pipeline.drawio.svg)
{.dark-invert}

Lets assume, the user enters as query source:

```python
price > 100 and category == "Books"
```

Then the lexer will produce these tokens:

```text
Identifier("price")
GreaterThan
Number("100")
And
Identifier("category")
Equal
String("Books")
```

The parser will then transform this stream of tokens into an abstract syntax tree (AST):

<!-- prettier-ignore -->
![Pipeline](/diagrams/expression-linq-binder/sample-ast.drawio.svg)
{.dark-invert}

And in the end the binder will convert this AST into a LINQ Expression

```csharp
Expression<Func<Product, bool>>
```

that can be displayed as

```csharp
p => p.Price > 100 && p.Category == "Books"
```

and for example used like

```csharp
var result = db.Products.Where(predicate);
```

## How does the API look?

At the end we want to have something like

```csharp
var compiler = new Linde.PredicateCompiler<Product>();

var predicate = expressionCompiler.CompileExpression("""
        price > 100 && category == "Books"
"""
);

var matchingProducts = products.Where(predicate);
```

## Description of the language

I named the language Linde. It is a tree, quite common in Germany and I like how they look in
spring.

Linde is an expression-only language. A source string must describe a predicate, an expression that
produces a Boolean value. It has no statements, variable declarations, assignments, or function
calls.

Instead, an identifier refers to a readable public property of the type passed to
`PredicateCompiler<T>`. Property lookup is case-insensitive, so `price`, `Price`, and `PRICE` all
resolve to the `Price` property of `Product`.

The language supports three kinds of literals:

- whole numbers such as `100`, which Linde represents as `decimal` values
- strings in double quotes, such as `"Books"`
- the Boolean values `true` and `false`

We can combine them with the following operators, listed from highest to lowest precedence:

| Operators             | Meaning                               |
| --------------------- | ------------------------------------- |
| `!`, `not`, unary `-` | Boolean negation and numeric negation |
| `*`, `/`              | Multiplication and division           |
| `+`, `-`              | Addition and subtraction              |
| `<`, `<=`, `>`, `>=`  | Relational comparison                 |
| `==`, `!=`, `is`      | Equality and inequality               |
| `&&`, `and`           | Short-circuiting Boolean AND          |
| `\|\|`, `or`          | Short-circuiting Boolean OR           |

Parentheses override this precedence. The word forms are case-insensitive, which means `AND`,
`True`, and `is` are valid too.

The smallest useful query compares one property with a literal:

```python {title="A comparison"}
price > 100
```

A Boolean property is already a predicate, so it does not need an explicit comparison with `true`:

```python {title="Combining predicates"}
price > 100 and inStock
```

The `is` keyword is an alternative spelling of `==`. Parentheses let us make the intended grouping
explicit:

```python {title="Equality and grouping"}
category is "Books" and (price < 50 or price >= 130)
```

Both the word and symbolic forms can be mixed in the same query:

```python {title="Negation and symbolic operators"}
not inStock || category != "Electronics"
```

Arithmetic expressions can appear on either side of a comparison:

```python {title="Arithmetic in a predicate"}
(price + 10) * 2 >= 300
```

Linde will not perform implicit type conversion. Both operands of an operator must already have
compatible .NET types. This is why the numeric examples work with `decimal`.

{{< note >}}Again, take a look at [crafting interpreters](https://craftinginterpreters.com/) from
Robert Nystrom. All of these important language design topics is taken care of in the
book.{{< /note >}} To make it easy for this post, string literals do not support escape sequences. A
query must also end in a Boolean value; `price + 10` is a valid arithmetic expression, but it cannot
serve as a predicate by itself. Of course this can all be implemented pretty easy, but the code
examples then tend to get bigger and bigger and this is not a post about language design.
