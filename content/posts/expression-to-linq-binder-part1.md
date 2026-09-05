+++
title = "From Filter Strings to LINQ (Part I)"
description = "See why runtime filter strings need a small language, then define the syntax and compilation pipeline that turns them into LINQ predicates."
date = "2026-09-05"
draft = false
tags = ["c#", "parser", "linq"]
math = true
+++

## Preface

The idea for this project goes back to a problem I encountered at work. We use a system-modeling
tool to define data types for middleware that transports data between applications. We wanted a
validation engine that could enforce policies on the data types we sent and received.

Problems like this always felt a little like a
[SAT solver](https://en.wikipedia.org/wiki/SAT_solver) hiding inside ordinary middleware. We are not
actually solving satisfiability here, but both problems ask us to represent and evaluate logical
rules.

I never had the chance to finish that project, and the idea refused to leave my brain. This series
is my attempt to give it somewhere else to live. I reduced the original problem to a smaller example
that I could explore outside work. In this first part, we will watch the problem grow and see what
it eventually demands from us.

## The Problem

Imagine we are building an application that exposes products:

```csharp {title="Product definition"}
record Product(
    string Name,
    string Category,
    decimal Price,
    bool InStock);
```

At some point, we want to filter this collection by its properties. With a fixed condition, life is
easy:

```csharp {title="Filtering with a fixed predicate"}
var matchingProducts = products
    .Where(p => p.Price > 100 && p.InStock);
```

Sooner or later, product management arrives with the perfectly reasonable requirement that ruins our
quiet afternoon:

> Users shall be able to define their own filters at runtime.

Runtime filters are useful in admin dashboards, reporting systems, automation tools, and search
features.

We then want users to be able to express:

{{< note >}}I use python for syntax highlighting of our small language. This is not python. Maybe it
works by accident.{{< /note >}}

```python {title="User query"}
price > 100 and inStock == true
```

The key constraint is that we do not know this condition when we compile the application. We need to
turn

```python {title="Filter source"}
price > 100 and inStock == true
```

into something like:

```csharp {title="Generated predicate"}
p => p.Price > 100 && p.InStock == true
```

We do not need to decide how the application creates this condition yet. From the caller's
perspective, the result only needs to be usable with LINQ:

```csharp {title="Applying a runtime filter"}
var matchingProducts = products.Where(predicate);
```

At this point, we do not know how to produce `predicate` from the user's text. Finding that bridge
is our problem!

## The obvious solution

We are almost certainly not the first developers to meet this problem. A straightforward answer is a
structured filter object:

```csharp {title="Product filter type"}
record ProductFilter(
    decimal? MinimumPrice,
    decimal? MaximumPrice,
    string? Category,
    bool? InStock);
```

Then we can construct a query:

```csharp {title="Applying a structured filter"}
IEnumerable<Product> ApplyFilter(
    IEnumerable<Product> query,
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

I think this is the right solution for many applications. We do not need a language when four
optional properties solve the problem.

But requirements, as they tend to do when nobody is watching, grow. At first, users want one
comparison:

```python {title="Simple query"}
price > 100
```

Then they combine multiple comparisons:

```python {title="Combined query"}
price > 100 and category == "Books"
```

Still fine. Then comes this:

```python {title="Grouped query"}
(price < 20 or price > 100) and inStock == true
```

Our pleasant little filter object starts to come apart at the seams. Users no longer specify only
values, they also define relationships and grouping. That is the transition point.

## A possible solution: Build the expression dynamically

{{< note >}}Does this already qualify to be a
[homoiconic](https://en.wikipedia.org/wiki/Homoiconicity) language?{{< /note >}} This is more
complicated, yes, but not yet a reason to panic. C# allows us to represent code as data through
expression trees.

Instead of:

```csharp {title="Simple predicate"}
p => p.Price > 100
```

we can also construct this:

```csharp {title="Constructing an expression tree"}
var parameter = Expression.Parameter(
    typeof(Product),
    "p");

var property = Expression.Property(
    parameter,
    nameof(Product.Price));

var value = Expression.Constant(100m);

var comparison = Expression.GreaterThan(
    property,
    value);

var predicate =
    Expression.Lambda<Func<Product, bool>>(
        comparison,
        parameter);
```

Very nice. This produces an expression tree with the following type:

```csharp {title="Expression tree type"}
Expression<Func<Product, bool>>
```

For this small example, we can split the query into three parts:

```text {title="Three query fragments"}
price
>
100
```

We then create the corresponding expression-tree nodes.

But now our user specifies the query from above:

```python {title="User query"}
price > 100 and inStock == true
```

Okay, perhaps we split on `and`. But what do we do on:

```python {title="Grouped query"}
(price < 20 or price > 100) and inStock == true
```

At this point, splitting the string starts to look less like a solution and more like a future bug
report.

## Accidental invention of a language

Our users are writing:

```python {title="Expression with grouping"}
price > 100 and (category == "Books" or category == "Games")
```

That is not merely a string. It has syntax.

It has literals:

```python {title="Literal examples"}
100
"Books"
true
```

Identifiers:

```python {title="Identifier examples"}
price
category
inStock
```

Operators:

```python {title="Operator examples"}
>
==
and
or
```

And grouping:

```python {title="Parenthesized grouping"}
(...)
```

More importantly, it has rules.

For example:

```python {title="Expression without explicit grouping"}
price > 100 and inStock == true
```

means:

```python {title="Equivalent explicit grouping"}
(price > 100) and (inStock == true)
```

Our application needs to understand that structure before it can generate an expression tree.

**We don't have a string-processing problem. We have a parsing problem.**

## The solution architecture

{{< note >}}If you are interested in this topic, checkout
[crafting interpreters](https://craftinginterpreters.com/) from Robert Nystrom. It is by far one of
the best books about how to build lexers, parser and interpreters. {{< /note >}} Once we admit that
we have a language, the architecture more or less invites itself in. We are going to build that tiny
language with the following pipeline.

<!-- prettier-ignore -->
![Pipeline from query source through lexer, parser, and binder to a LINQ expression](/diagrams/expression-linq-binder/pipeline.drawio.svg)
{.dark-invert}

Let's assume the user enters this query:

```python {title="Query source"}
price > 100 and category == "Books"
```

The lexer produces a token stream. Its diagnostic output also contains source positions, but we can
use the following compact representation here:

```text {title="Simplified token stream"}
IdentifierToken("price")
GreaterThanToken(">")
NumberToken("100")
AmpersandAmpersandToken("and")
IdentifierToken("category")
EqualEqualToken("==")
StringToken("Books")
EndOfInputToken
```

The parser will then transform this stream of tokens into an abstract syntax tree (AST):

<!-- prettier-ignore -->
![Abstract syntax tree for the product-filter query](/diagrams/expression-linq-binder/sample-ast.drawio.svg)
{.dark-invert}

The binder then converts the AST into a LINQ expression tree:

```csharp {title="Expression tree type"}
Expression<Func<Product, bool>>
```

We can display that tree as:

```csharp {title="Generated expression"}
p => p.Price > 100 && p.Category == "Books"
```

Finally, `PredicateCompiler<T>` compiles the tree into a `Func<Product, bool>`. We can pass this
delegate to LINQ's `Where` method for our in-memory collection:

```csharp {title="Applying the compiled predicate"}
var matchingProducts = products.Where(predicate);
```

## What does the API look like?

The complete API usage looks like this:

```csharp {title="Compiling and applying a query"}
var customExpression = "(category is \"Books\" and price > 130) and instock";

var expressionCompiler = new Linde.PredicateCompiler<Product>();

var predicate = expressionCompiler.CompileExpression(customExpression);

var matchingProducts = products.Where(predicate);
```

## Description of the language

I named the language Linde, the German word for linden tree. They are common here, and I like how
they look in spring.

Linde is an expression-only language. A source string must describe a predicate, an expression that
produces a Boolean value. It has no statements, variable declarations, assignments, or function
calls.

Instead, an identifier refers to a readable public property of the type passed to
`PredicateCompiler<T>`. Property lookup is case-insensitive, so `price`, `Price`, and `PRICE` all
resolve to the `Price` property of `Product`.

The language supports three kinds of literals:

- numbers such as `100` and `19.95`, which Linde represents as `decimal` values
- strings in double quotes, such as `"Books"`
- the Boolean values `true` and `false`

We can combine them with the following operators, listed from highest to lowest precedence:

| Operators             | Meaning                               |
| --------------------- | ------------------------------------- |
| `!`, `not`, unary `-` | Boolean negation and numeric negation |
| `*`, `/`              | Multiplication and division           |
| `+`, `-`              | Addition and subtraction              |
| `<`, `<=`, `>`, `>=`  | Relational comparison                 |
| `==`, `is`            | Equality                              |
| `!=`                  | Inequality                            |
| `&&`, `and`           | Short-circuiting Boolean AND          |
| `\|\|`, `or`          | Short-circuiting Boolean OR           |

Parentheses override this precedence. Keywords are case-insensitive, which means `AND`, `True`, and
`is` are valid too.

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

Linde does not perform implicit type conversion. Both operands of an operator must already have
compatible .NET types. The numeric examples work because Linde represents numeric literals as
`decimal` values and `Product.Price` is also a `decimal`.

{{< note >}}Again, take a look at [crafting interpreters](https://craftinginterpreters.com/) from
Robert Nystrom. All of these important language design topics is taken care of in the
book.{{< /note >}} For this post, string literals do not support escape sequences. A query must also
end in a Boolean value. For example, `price + 10` is a syntactically valid arithmetic expression,
but the binder rejects it as a predicate because its result is not Boolean. None of these
limitations is sacred. Removing them would mostly make the examples grow until this quietly turned
into a post about language design—which it is not.

## What comes next

That is enough accidental language design for one post. We now know what Linde accepts and what it
produces. We also have a pipeline that separates recognizing tokens, understanding their structure,
and binding that structure to .NET properties. In the next part, we can start turning the query
source into tokens.
