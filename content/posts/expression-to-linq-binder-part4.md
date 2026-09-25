+++
title = "From Filter Strings to LINQ (Part IV)"
description = "Bind the parsed syntax tree to .NET properties, build a typed LINQ expression tree, and connect the complete Linde compilation pipeline."
date = "2026-09-25"
draft = true
tags = ["c#", "parser", "linq", "dotnet"]
math = true
+++

This post continues from [Part III]({{< ref "expression-to-linq-binder-part3.md" >}}), where we
turned Linde's tokens into an abstract syntax tree (AST). In this final part, we build the binder.
It resolves property names, checks whether the requested operations make sense for their .NET types,
and turns the AST into a LINQ expression tree.

I assume the lexer, parser, and syntax nodes from the earlier parts are in place. The short recap
below shows how they fit around the binder.

The complete implementation from this series is now available in the
[Linde repository on GitHub](https://github.com/visviva/Linde).

Then we can finally connect all the stages and feed the result to `Where`. Our tiny language is
about to become useful.

## Where We Are

The first three posts gave us most of the compilation pipeline:

1. [Part I]({{< ref "expression-to-linq-binder-part1.md" >}}) defined Linde's language and the
   problem it solves.
2. [Part II]({{< ref "expression-to-linq-binder-part2.md" >}}) built the lexer that turns source
   text into tokens.
3. [Part III]({{< ref "expression-to-linq-binder-part3.md" >}}) built the parser that arranges those
   tokens into an AST.

<!-- prettier-ignore -->
![Pipeline from query source through lexer, parser, and binder to a LINQ expression](/diagrams/expression-linq-binder/pipeline.drawio.svg)
{.dark-invert}

For this query:

```python {title="Product Filter"}
(category is "Books" and price > 130) and instock
```

the parser produces this AST:

```text {title="Parsed Abstract Syntax Tree"}
and
├── and
│   ├── is
│   │   ├── category
│   │   └── "Books"
│   └── >
│       ├── price
│       └── 130
└── instock
```

The parser knows that `and` has two operands and that `price` is a name expression. It does not know
that `price` refers to `Product.Price`, that the property has the type `decimal`, or that the whole
tree must produce a `bool`. That separation is intentional: syntax records the structure, while
binding gives it meaning for a particular .NET type.

For our sample record:

```csharp {title="Product Definition"}
public record Product(
    string Name,
    string Category,
    decimal Price,
    bool InStock);
```

the binder should turn the AST into:

```csharp {title="Expected LINQ Expression"}
p => ((p.Category == "Books" && p.Price > 130m) && p.InStock)
```

More precisely, it should produce an `Expression<Func<Product, bool>>` that represents this code as
data.

## Building the Binder

The binder depends on the target type, so we make it generic. It receives the root of the AST and
owns the parameter used throughout the generated expression:

```csharp {title="Binder State"}
internal sealed class Binder<T>(ExpressionSyntax Ast)
{
    private readonly ParameterExpression parameter =
        Expression.Parameter(typeof(T), "p");
}
```

It is important to create this parameter once. Two calls to `Expression.Parameter(typeof(T), "p")`
may print the same text, but they create two different parameter nodes. The property accesses in the
body and the parameter declared by the lambda must refer to the same node.

The binder recursively visits each syntax node and returns the corresponding
`System.Linq.Expressions.Expression`. The AST and the LINQ expression tree have similar shapes, so
the transformation is pleasantly direct:

| Syntax node                      | LINQ expression node                  |
| -------------------------------- | ------------------------------------- |
| `NumericLiteralExpressionSyntax` | `ConstantExpression`                  |
| `BooleanLiteralExpressionSyntax` | `ConstantExpression`                  |
| `StringLiteralExpressionSyntax`  | `ConstantExpression`                  |
| `NameExpressionSyntax`           | `MemberExpression`                    |
| `PrefixUnaryExpressionSyntax`    | `UnaryExpression` or binary operation |
| `BinaryExpressionSyntax`         | `BinaryExpression`                    |

The table is not quite one-to-one. Our implementation represents unary minus as multiplication by
`-1`, for example. The difference is intentional. The AST describes the language; the expression
tree describes how .NET will evaluate it. They do not have to use identical node types.

### Compiling Literals

We start with the leaf nodes. The parser has already converted literal text into `decimal`, `bool`,
and `string` values. The binder only needs to wrap those values in constant expressions:

```csharp {title="Compile Literal Expressions"}
private static ConstantExpression CompileNumberExpression(
    NumericLiteralExpressionSyntax number) =>
    Expression.Constant(number.Value);

private static ConstantExpression CompileBooleanExpression(
    BooleanLiteralExpressionSyntax boolean) =>
    Expression.Constant(boolean.Value);

private static ConstantExpression CompileStringExpression(
    StringLiteralExpressionSyntax literal) =>
    Expression.Constant(literal.Value);
```

`Expression.Constant` infers the type from the value. A numeric literal therefore becomes a constant
of type `decimal`, not `int` or `double`. This follows from the language decision in Part I and from
the parser's `NumericLiteralExpressionSyntax(decimal Value, ...)` node.

That decision also explains why this works:

```python {title="Compatible Decimal Comparison"}
price > 130
```

`Product.Price` and `130` both have the type `decimal`. Linde does not insert implicit numeric
conversions, so it would reject the same literal when compared with a `double` property. Supporting
numeric promotion is possible, but it needs explicit language rules. I will leave that particular
rabbit hole undisturbed.

### Resolving Identifiers

A name such as `price` only becomes meaningful when we bind it against `Product`. We first collect
the readable public instance properties of `T`:

```csharp {title="Collect Bindable Properties"}
private static readonly Dictionary<string, PropertyInfo> properties = typeof(T)
    .GetProperties(BindingFlags.Instance | BindingFlags.Public)
    .Where(property =>
        property.GetMethod is not null
        && !property.GetMethod.IsStatic
        && property.GetIndexParameters().Length == 0
    )
    .ToDictionary(
        property => property.Name,
        property => property,
        StringComparer.OrdinalIgnoreCase);
```

The code accepts only readable, non-static properties without index parameters. We can access each
of them through the single `p` parameter. The case-insensitive dictionary implements the language
rule that `price`, `Price`, and `PRICE` all refer to the same property.

The dictionary is static because its contents depend only on `T`. A `Binder<Product>` can therefore
reuse the same property lookup table for every query instead of repeating the reflection work.

With that lookup table, compiling a name becomes a property-access expression:

```csharp {title="Compile Identifier Expressions"}
private MemberExpression CompileIdentifierExpression(
    NameExpressionSyntax identifier) =>
    MemberExpression.Property(
        parameter,
        properties.TryGetValue(identifier.Identifier, out var property)
            ? property
            : throw new BinderException(
                $"IdentifierToken {identifier.Identifier} is unknown "
                    + $"and not a member of {typeof(T).Name}."
            )
    );
```

For `price`, this creates a node equivalent to `p.Price`. For `category`, it creates `p.Category`.
If the user writes `prize`, the binder reports the unknown identifier instead of leaving us to
wonder why our shop has developed an unexpected competition system.

{{< note >}}The actual code keeps the exception message on one interpolated line. I split it here so
that the example fits the page.{{< /note >}}

## Walking the Tree

We now have compilation methods for all leaf nodes. A single dispatcher selects the right method for
every kind of syntax node:

```csharp {title="Dispatch Syntax Nodes"}
private Expression CompileExpression(ExpressionSyntax node) =>
    node switch
    {
        NumericLiteralExpressionSyntax numberExpression =>
            CompileNumberExpression(numberExpression),
        BooleanLiteralExpressionSyntax boolExpression =>
            CompileBooleanExpression(boolExpression),
        StringLiteralExpressionSyntax stringExpression =>
            CompileStringExpression(stringExpression),
        NameExpressionSyntax identifierExpression =>
            CompileIdentifierExpression(identifierExpression),
        PrefixUnaryExpressionSyntax unaryExpression =>
            CompileUnaryExpression(unaryExpression),
        BinaryExpressionSyntax binaryExpression =>
            CompileBinaryExpression(binaryExpression),
        _ => throw new BinderException($"BadToken AST node: {node}"),
    };
```

`CompileExpression` is the recursive center of the binder. Literal and name nodes end the recursion.
Unary nodes compile one child, and binary nodes compile two. This is the same walk we used in the
syntax-tree printer. This time, however, we build a second tree instead of printing labels.

### Compiling Unary Expressions

Linde has two prefix unary operators: numeric negation and Boolean negation. The binder maps them to
expression-tree operations:

```csharp {title="Compile Unary Expressions"}
private Expression CompileUnaryExpression(
    PrefixUnaryExpressionSyntax unary) =>
    unary.OperatorToken.Kind switch
    {
        SyntaxKind.MinusToken => Expression.Multiply(
            Expression.Constant(-1.0m),
            CompileExpression(unary.Operand)
        ),
        SyntaxKind.BangToken =>
            Expression.Not(CompileExpression(unary.Operand)),

        _ => throw new BinderException(
            $"BadToken unary operator: {unary.OperatorToken.Text} "
                + $"at position {unary.OperatorToken.Position}"
        ),
    };
```

Unary minus becomes multiplication by `-1.0m`. `!` and its keyword form `not` become
`Expression.Not`.

The parser only tells us that a unary operator has an operand. It does not validate that the operand
has a suitable type. If we try to bind `not price`, `Expression.Not` rejects the `decimal` operand.
If we try `-instock`, `Expression.Multiply` rejects the combination of `decimal` and `bool`. The
expression-tree API therefore validates operator compatibility for us.

We could catch those exceptions and turn them into diagnostics that mention the original source
position. The current implementation does not do that yet. Good diagnostics are an entire project
disguised as a small feature.

### Compiling Binary Expressions

Binary expressions follow the same recursive pattern. We compile the left and right children first,
then select the expression-tree factory for the operator:

```csharp {title="Compile Binary Expressions"}
private BinaryExpression CompileBinaryExpression(
    BinaryExpressionSyntax binary)
{
    var left = CompileExpression(binary.Left);
    var right = CompileExpression(binary.Right);

    return binary.OperatorToken.Kind switch
    {
        SyntaxKind.PlusToken =>
            BinaryExpression.Add(left, right),
        SyntaxKind.MinusToken =>
            BinaryExpression.Subtract(left, right),
        SyntaxKind.StarToken =>
            BinaryExpression.Multiply(left, right),
        SyntaxKind.SlashToken =>
            BinaryExpression.Divide(left, right),
        SyntaxKind.EqualEqualToken =>
            BinaryExpression.Equal(left, right),
        SyntaxKind.BangEqualToken =>
            BinaryExpression.NotEqual(left, right),
        SyntaxKind.GreaterThanToken =>
            BinaryExpression.GreaterThan(left, right),
        SyntaxKind.LessThanToken =>
            BinaryExpression.LessThan(left, right),
        SyntaxKind.GreaterThanOrEqualsToken =>
            BinaryExpression.GreaterThanOrEqual(left, right),
        SyntaxKind.LessThanOrEqualsToken =>
            BinaryExpression.LessThanOrEqual(left, right),
        SyntaxKind.AmpersandAmpersandToken =>
            BinaryExpression.AndAlso(left, right),
        SyntaxKind.PipePipeToken =>
            BinaryExpression.OrElse(left, right),
        _ => throw new BinderException(
            $"BadToken binary operator: {binary.OperatorToken.Text} "
                + $"at position {binary.OperatorToken.Position}"
        ),
    };
}
```

Arithmetic and comparison operators map directly to their expression-tree factories. The logical
operators deserve a closer look:

| Linde operator | Expression-tree factory | C# behavior          |
| -------------- | ----------------------- | -------------------- |
| `&&` / `and`   | `Expression.AndAlso`    | Short-circuiting AND |
| `\|\|` / `or`  | `Expression.OrElse`     | Short-circuiting OR  |

`AndAlso` and `OrElse` preserve the short-circuiting behavior defined by Linde's language
description. `Expression.And` and `Expression.Or` would evaluate both sides and would describe
different semantics.

As with unary expressions, these factory methods validate the operand types while constructing the
tree. `Expression.Add` needs an addition operator for the two operand types. `Expression.AndAlso`
needs a valid conditional AND operation. `Expression.Equal` needs operands that can be compared. The
binder does not maintain a second, hand-written .NET type system; it asks the expression-tree API to
construct the requested operation and lets that API reject invalid combinations.

That also keeps Linde strict. Consider:

```python {title="Mismatched Operand Types"}
price == "130"
```

The left side has the type `decimal` and the right side has the type `string`. Linde does not guess
that the string should become a number. The expression cannot be bound.

## Creating the Predicate

After `CompileExpression` has recursively transformed the complete AST, we have the body of the
lambda. There is one final language rule to enforce: a filter must produce a Boolean value.

```csharp {title="Compile the Predicate Lambda"}
public Expression<Func<T, bool>> Compile()
{
    var body = CompileExpression(Ast);

    if (body.Type != typeof(bool))
    {
        throw new BinderException(
            $"Predicate must have type of bool, "
                + $"but has type of {body.Type.Name}"
        );
    }

    return Expression.Lambda<Func<T, bool>>(body, parameter);
}
```

This check separates an expression from a predicate. The following source is valid arithmetic:

```python {title="Valid Expression but Invalid Predicate"}
price + 10
```

The parser accepts it, and the binder can construct its addition node. Its result type is `decimal`,
however, so it cannot become an `Expression<Func<Product, bool>>`. The explicit check lets us report
that problem before calling `Expression.Lambda`.

For our complete query, the result prints as:

```text {title="Bound LINQ Expression"}
p => (((p.Category == "Books") AndAlso (p.Price > 130)) AndAlso p.InStock)
```

The expression tree's default string representation uses names such as `AndAlso`, but the tree
represents the same short-circuiting operation as C#'s `&&`.

## Native AOT and Reflection

The sample project also publishes with Native Ahead-of-Time (AOT) compilation. That matters because
the binder discovers properties with reflection. A trimmer cannot infer which public properties a
future query will mention from a string entered at runtime.

We tell it that the public properties of `T` must remain available:

```csharp {title="Preserve Public Properties for Binding"}
internal sealed class Binder<
    [DynamicallyAccessedMembers(
        DynamicallyAccessedMemberTypes.PublicProperties)] T
>(ExpressionSyntax Ast)
{
    // ...
}
```

The binary expression factories may also need public operator methods on `decimal`, so the binary
compilation method carries a dynamic dependency:

```csharp {title="Preserve Decimal Operator Methods"}
[DynamicDependency(
    DynamicallyAccessedMemberTypes.PublicMethods,
    typeof(decimal))]
private BinaryExpression CompileBinaryExpression(
    BinaryExpressionSyntax binary)
{
    // ...
}
```

These annotations do not change how the binder behaves. They describe its reflection requirements to
the trimming and AOT toolchain. If your application does not use trimming or Native AOT, the core
binding algorithm remains the same.

## Connecting the Complete Pipeline

We now have every stage. `PredicateCompiler<T>` gives them one path from source text to a delegate:

```csharp {title="Complete Predicate Compiler"}
internal sealed class PredicateCompiler<
    [DynamicallyAccessedMembers(
        DynamicallyAccessedMemberTypes.PublicProperties)] T
>(bool printTokens = false, bool printAst = false, bool printExpression = false)
{
    public Func<T, bool> CompileExpression(string predicateExpression)
    {
        var scanner = new Syntax.Lexer(predicateExpression);
        var tokens = scanner.Scan().ToList();

        if (printTokens)
        {
            Console.WriteLine("Tokens:\n");
            foreach (var token in tokens)
            {
                Console.WriteLine(token);
            }
            Console.WriteLine();
        }

        var parser = new Parser(tokens);
        var ast = parser.Parse();

        if (printAst)
        {
            var astPrinter = new SyntaxTreePrinter(ast);
            Console.WriteLine("Abstract Syntax Tree:\n");
            astPrinter.Print();
            Console.WriteLine();
        }

        var compiler = new Binder.Binder<T>(ast);
        var expression = compiler.Compile();

        if (printExpression)
        {
            Console.WriteLine($"Compiled Expression: {expression}\n");
        }

        return expression.Compile();
    }
}
```

This small class is where the complete series comes together:

```text {title="Linde Compilation Pipeline"}
source string
    ↓ Lexer.Scan()
tokens
    ↓ Parser.Parse()
abstract syntax tree
    ↓ Binder<T>.Compile()
Expression<Func<T, bool>>
    ↓ LambdaExpression.Compile()
Func<T, bool>
```

The optional diagnostic output lets us inspect what each stage received and produced without mixing
printing code into the lexer, parser, or binder itself.

The two `Compile` calls perform different jobs. `Binder<T>.Compile()` builds an expression tree. The
later `expression.Compile()` is the .NET operation that turns that tree into executable code
represented by a delegate.

That delegate is what `IEnumerable<T>.Where` expects.

## Running the Complete Example

We can now return to the example from Part I:

```csharp {title="Compile and Apply a Runtime Filter"}
var products = new[]
{
    new Product("C# in Depth", "Books", 120m, true),
    new Product("Rare Book", "Books", 250m, false),
    new Product("The Pragmatic Programmer", "Books", 135m, true),
    new Product("Algorithms Handbook", "Books", 145m, true),
};

var source = "(category is \"Books\" and price > 130) and instock";

var expressionCompiler = new Linde.PredicateCompiler<Product>(
    printTokens: true,
    printAst: true,
    printExpression: true
);

var predicate = expressionCompiler.CompileExpression(source);
var matchingProducts = products.Where(predicate);
```

The query selects the two books that cost more than 130 and are in stock:

```text {title="Matching Products"}
Product { Name = The Pragmatic Programmer, Category = Books, Price = 135, InStock = True }
Product { Name = Algorithms Handbook, Category = Books, Price = 145, InStock = True }
```

There is one important boundary. `PredicateCompiler<T>` returns a `Func<T, bool>`, so this version
targets in-memory `IEnumerable<T>` collections. An `IQueryable<T>` provider, such as an
object-relational mapper, usually needs the uncompiled `Expression<Func<T, bool>>` so that it can
translate the tree into another query language. The binder already produces that tree, so exposing
it would be a small API change. Whether a particular provider supports every generated node is a
separate question.

## What We Built

We started with a requirement that sounded like string processing:

```python {title="Original Runtime Filter"}
price > 100 and instock
```

The filter turned out to be a small language. Once we treated it as one, the responsibilities became
clear:

- the lexer decides which characters form tokens;
- the parser decides how those tokens form an expression;
- the binder decides what that expression means for a .NET type;
- the expression compiler turns the bound tree into an executable delegate.

Each stage removes one kind of uncertainty. Characters become tokens, tokens become structure, names
become properties, and the typed expression tree becomes code that LINQ can call.

Linde is deliberately small. It has no null literal, member access, method calls, implicit numeric
conversions, escaped strings, or polished diagnostics. Those are not missing `switch` cases so much
as language-design decisions waiting to happen. Even a tiny language has a remarkable appetite for
features.

That list is also a roadmap. A useful next step is to choose one boundary, such as better
diagnostics, nullable values, or `IQueryable<T>` support, and design it as part of the language
instead of adding every feature at once.

But the original problem is solved. A user can write a filter at runtime, and we can turn it into a
strongly typed predicate without splitting strings and hoping the parentheses remain friendly.
