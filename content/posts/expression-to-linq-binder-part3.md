+++
title = "From Filter Strings to LINQ (Part III)"
description = "Build the parser for a small filter language and turn tokens into an AST."
date = "2026-09-10"
draft = true
tags = ["c#", "parser", "linq", "dotnet"]
math = true
+++

This post continues from [Part II]({{< ref "expression-to-linq-binder-part2.md" >}}), where we
implemented Linde's lexer. In this part, we build the second stage of that pipeline: the parser.

## Recursive Descent Parsers

There are many ways to parse expressions: Pratt parsing, precedence climbing, recursive descent, the
shunting-yard algorithm, parser combinators, and parser generators. These categories overlap.
Recursive descent is a top-down implementation technique that is often used for LL grammars.
[ANTLR](https://www.antlr.org/) generates top-down parsers, while
[Bison](https://www.gnu.org/software/bison/) generates bottom-up parsers. We could also use a parser
combinator library such as [Pidgin](https://github.com/benjamin-hodgson/Pidgin).

I asked GPT 5.6 which parser is best for expressions, and it gave me the following table. Some rows
describe implementation techniques, while others describe grammar families, so this is a rough
comparison rather than an authoritative ranking:

| Parser / technique      | Best suited for                    | Expression parsing     |
| ----------------------- | ---------------------------------- | ---------------------- |
| **Pratt parser**        | Languages with many operators      | Excellent              |
| **Precedence climbing** | Binary/unary operator expressions  | Excellent              |
| **Recursive descent**   | Small/medium hand-written grammars | Very good              |
| **Shunting-yard**       | Mathematical expressions           | Very good              |
| **LL / LL(k)**          | Predictive grammars                | Good                   |
| **PEG / Packrat**       | Convenient grammar definitions     | Good                   |
| **LR / LALR / LR(1)**   | Full programming languages         | Excellent, but heavier |

{{< note >}}When I started this post, I was actually starting on implementing a parser combinator,
but then this post would explode. I will definitly explore this in another post. {{< /note >}}I have
implemented a Pratt parser before, and based on that experience, I expect precedence climbing would
not be too hard to understand. But I also know that a Pratt parser is not intuitive when it is your
first contact with parsers. It definitely took me some time to understand its magic.

So we will implement a recursive descent parser. In my opinion, it is usually the clearest option.
There is also a direct mapping from grammar rules to methods, which is quite nice.

## Developing the Grammar

In my opinion, developing the grammar is much harder than writing the parser. A good rule of thumb
is to design the language from examples and decide what the abstract syntax tree (AST) should look
like. We can then derive the grammar from that AST.

### Simple Expressions

So let's start with the classic `1 + 2 * price`. Based on the precedence rules we learned in school,
we expect this AST:

```text {title="Expected AST"}
+
├── 1
└── *
    ├── 2
    └── price
```

Let's try to find a general rule for this AST. At the bottom of the tree, we have numbers,
identifiers, strings, `true`, and `false`. These basic expressions are typically called primaries,
and they cannot be split any further. We can represent the rule in an
[EBNF](https://en.wikipedia.org/wiki/Extended_Backus%E2%80%93Naur_form)-style notation:

```text {title="Primary Expression Grammar"}
primary ::= NUMBER
          | STRING
          | TRUE
          | FALSE
          | IDENTIFIER
```

We also know that multiplication binds more strongly than addition, so we can write this rule:

```text {title="Multiplication Grammar"}
multiplication ::= primary ((STAR | SLASH) primary)*
```

Here, `*` means zero or more repetitions, and `?` means zero or one. All uppercase names represent
tokens produced by the lexer.

The `*` also means that we can write `1 * 2 * 3 * 4 * 5 * ...`. We do not want to limit the number
of operands. When we parse such an expression, the AST looks like this:

```text {title="Left-Associative Multiplication AST"}
*
├── *
│   ├── *
│   │   ├── *
│   │   │   ├── 1
│   │   │   └── 2
│   │   └── 3
│   └── 4
└── 5
```

The parser groups the primaries from the left into nested binary nodes. This is called left
associativity.

The addition at the root of our first AST has two operands: the literal `1` and a multiplication.
More generally, addition accepts multiplication expressions as its operands:

```text {title="Addition Grammar"}
addition ::= multiplication ((PLUS | MINUS) multiplication)*
```

Now let's change the expression to `-1 + 2 * price`. How do we represent the `-1`? When we lex it,
we get a `MinusToken` followed by a `NumberToken`. The lexer could recognize this combination as a
single negative number, but I prefer to keep the sign separate and build this AST:

```text {title="Unary Minus AST"}
+
├── -
│   └── 1
└── *
    ├── 2
    └── price
```

The `-` node with one operand is a prefix unary expression. The same rule handles numeric negation
with `-` and Boolean negation with `!`:

```text {title="Unary Expression Grammar"}
unary ::= (MINUS | NOT) unary
        | primary
```

We now need to adapt the multiplication rule to:

```text {title="Use Unaries in Multiplication" diff=true}
-multiplication ::= primary ((STAR | SLASH) primary)*
+multiplication ::= unary ((STAR | SLASH) unary)*
```

Let's write down what we have found so far:

```text {title="Arithmetic Expression Grammar"}
addition       ::= multiplication ((PLUS | MINUS) multiplication)*

multiplication ::= unary ((STAR | SLASH) unary)*

unary          ::= (MINUS | NOT) unary
                 | primary

primary        ::= NUMBER
                 | STRING
                 | TRUE
                 | FALSE
                 | IDENTIFIER
```

### More Complex Expressions

Basic arithmetic is covered, but we have not touched Boolean operators, comparisons, or equality.
Our next expression is:

```python {title="Boolean Filter Expression"}
price + 10 * 2 > 100 && category == "Books" || !instock
```

The AST is harder to picture now. So we do what every student would do and make the grouping
explicit:

```python {title="Explicitly Grouped Filter"}
(((price + (10 * 2)) > 100) && (category == "Books")) || (!instock)
```

Much clearer. These parentheses also expose our assumptions about precedence. The multiplication
`10 * 2` binds more strongly than the surrounding addition, and the addition binds more strongly
than the comparison. Similarly, `==` binds more strongly than `&&`. The `||` operator has the lowest
precedence. Let's turn those assumptions into rules, starting with comparisons:

```text {title="Comparison Grammar"}
comparison ::= addition ((LESS | LESS-EQUAL | GREATER | GREATER-EQUAL) addition)?
```

Now consider this expression:

```text {title="Equality and Comparison Example"}
isSale == price < 10
```

I would group it as `isSale == (price < 10)`. The comparison therefore binds more strongly than
equality, and we can write:

```text {title="Equality Grammar"}
equality ::= comparison ((EQUAL | NOT-EQUAL) comparison)?
```

Following these rules and our first grouping, an expression such as `a == b && c == d || e == f`
becomes `((a == b) && (c == d)) || (e == f)`. The last remaining rules are:

```text {title="Logical Operator Grammar"}
logical-or     ::= logical-and (OR logical-and)*

logical-and    ::= equality (AND equality)*
```

If you look closely, you can see a `?` after comparison and equality. I decided not to allow chains
such as `a < b < c` or `5 == 6 == 7`. Parenthesizing the first example as `(a < b) < c` does not
make it meaningful: `a < b` produces a Boolean value, which we cannot compare with `c`. The intended
relationship should be explicit, for example `a < b && b < c`.

### Breaking the Rules

Going back to `1 + 2 * price`, suppose we now want `(1 + 2) * price`. The AST should look like this:

```text {title="Parenthesized AST"}
*
├── +
│   ├── 1
│   └── 2
└── price
```

How do we do that? Any expression can appear inside parentheses, from arithmetic to Boolean logic.
This gives us a hint. The rule must look something like this:

```text {title="Parenthesized Expression Grammar"}
parenthesized-anything ::= OPEN-PAREN logical-or CLOSE-PAREN
```

But where should we put this rule? It does not fit neatly among the existing rules. It cannot be the
top-level rule because not every expression starts with `(` and ends with `)`. Making both
parentheses optional does not work either:

```text {title="Incorrect Optional Parentheses Grammar"}
parenthesized-anything ::= OPEN-PAREN? logical-or CLOSE-PAREN?
```

This would allow malformed expressions such as `1 + 2 )`, and we definitely do not want that. The
expression `(1 + 2) * price` gives us another hint. Both operands of a multiplication must be unary
expressions, and every unary expression eventually ends in a primary. We can therefore try treating
the parenthesized expression as a unary:

```text {title="Add Parentheses to Unary Expressions" diff=true}
unary ::= (MINUS | NOT) unary
        | primary
+       | OPEN-PAREN logical-or CLOSE-PAREN
```

That works for many expressions, but how would we parse `-(1) * price`? We could write:

```text {title="Add Optional Prefix to Parenthesized Expressions" diff=true}
unary ::= (MINUS | NOT) unary
        | primary
+       | (MINUS | NOT)? OPEN-PAREN logical-or CLOSE-PAREN
```

or

```text {title="Add Parentheses to Primary Expressions" diff=true}
primary ::= NUMBER
          | STRING
          | TRUE
          | FALSE
          | IDENTIFIER
+         | OPEN-PAREN logical-or CLOSE-PAREN
```

I prefer the latter because it is cleaner. Once a parenthesized expression is a primary, all unary
operators can apply to it without another special case.

### The Grammar

We now have all the rules for an expression in our language. We also give `expression` its own rule.
Let's write down the complete grammar:

```bnf {title="Complete Expression Grammar"}
expression     ::= logical-or

logical-or     ::= logical-and (OR logical-and)*

logical-and    ::= equality (AND equality)*

equality       ::= comparison ((EQUAL | NOT-EQUAL) comparison)?

comparison     ::= addition ((LESS | LESS-EQUAL | GREATER | GREATER-EQUAL) addition)?

addition       ::= multiplication ((PLUS | MINUS) multiplication)*

multiplication ::= unary ((STAR | SLASH) unary)*

unary          ::= (MINUS | NOT) unary
                 | primary

primary        ::= NUMBER
                 | STRING
                 | TRUE
                 | FALSE
                 | IDENTIFIER
                 | OPEN-PAREN expression CLOSE-PAREN
```

## Writing the Parser

The nice part of recursive descent is that developing the grammar also gives us the structure of the
code. Each grammar rule becomes a method. The lexer gives us a list of tokens, so we first need a
few mechanisms to move through that list.

```csharp {title="Parser State"}
sealed class Parser(IReadOnlyList<SyntaxToken> tokens)
{
    private int position;

    private SyntaxToken Current => tokens[position];
    private SyntaxToken Previous => tokens[position - 1];

    ...
}
```

As in the lexer, we need an operation that moves the current position forward:

```csharp {title="Consume the Current Token"}
private void Consume()
{
    if (position < tokens.Count)
    {
        position++;
    }
}
```

Many grammar rules accept more than one operator. A `Match` helper checks these alternatives and
consumes the current token when one matches:

```csharp {title="Match Token Kinds"}
private bool Match(params ReadOnlySpan<SyntaxKind> tokenTypes)
{
    if (!tokenTypes.Contains(Current.Kind))
    {
        return false;
    }

    Consume();
    return true;
}
```

Some tokens are required rather than optional. For example, every `(` needs a matching `)`. An
`Expect` helper consumes the required token or reports an error:

```csharp {title="Expect a Token Kind"}
private SyntaxToken Expect(SyntaxKind tokenType)
{
    if (Current.Kind != tokenType)
    {
        throw new ParserException(Current, tokenType);
    }

    var token = Current;
    Consume();
    return token;
}
```

The important detail is that the parser has one shared cursor: `position`. The `Current` and
`Previous` properties only read tokens relative to that cursor. They never move it. `Consume` is the
only method that changes `position`, and it always advances by one token.

`Match` and `Expect` build different decisions on top of that single operation. A successful `Match`
calls `Consume` and returns `true`; a failed `Match` returns `false` without moving. A successful
`Expect` also calls `Consume`, but a failed `Expect` throws before the cursor can move. The same
token therefore remains current when either check fails.

<!-- prettier-ignore -->
![Four token-list snapshots showing how successful calls to Expect and Match delegate to Consume, while a failed Match leaves the parser position unchanged](/diagrams/expression-linq-binder/parser-cursor-helpers.svg)

The parser reports these errors through a dedicated exception:

```csharp {title="Parser Exception"}
sealed class ParserException : Exception
{
    public ParserException(SyntaxToken token)
        : base($"Unexpected token: {token} at position: {token.Position}") { }

    public ParserException(SyntaxToken token, SyntaxKind expected)
        : base($"Unexpected token: {token} at position: {token.Position}, expected {expected}") { }

    public ParserException(SyntaxToken token, SyntaxKind expected1, SyntaxKind expected2)
        : base(
            $"Unexpected token: {token} at position: {token.Position}, expected {expected1} or {expected2}"
        ) { }
}
```

But how do we represent the AST itself? Looking at the grammar again, many rules have the same
shape. We have primary literals and names, prefix unary expressions, and several kinds of binary
expressions. We can represent them with a small set of syntax nodes:

```csharp {title="Expression Syntax Nodes"}
abstract record ExpressionSyntax;

sealed record NumericLiteralExpressionSyntax(decimal Value, SyntaxToken Token) : ExpressionSyntax;

sealed record BooleanLiteralExpressionSyntax(bool Value, SyntaxToken Token) : ExpressionSyntax;

sealed record StringLiteralExpressionSyntax(string Value, SyntaxToken Token) : ExpressionSyntax;

sealed record NameExpressionSyntax(string Identifier, SyntaxToken Token) : ExpressionSyntax;

sealed record PrefixUnaryExpressionSyntax(SyntaxToken OperatorToken, ExpressionSyntax Operand)
    : ExpressionSyntax;

sealed record BinaryExpressionSyntax(
    ExpressionSyntax Left,
    SyntaxToken OperatorToken,
    ExpressionSyntax Right
) : ExpressionSyntax;
```

The AST does not strictly need to retain each token. However, tokens contain source positions, which
are useful for debugging and for producing helpful error messages later.

### Parsing Primaries

We start by parsing primary expressions:

```csharp {title="Parse Primary Expressions"}
private NumericLiteralExpressionSyntax ParseNumericLiteralExpression()
{
    var token = Expect(SyntaxKind.NumberToken);
    var cleanedText = token.Text.Replace(",", "");
    return new NumericLiteralExpressionSyntax(decimal.Parse(cleanedText), token);
}

private NameExpressionSyntax ParseNameExpression()
{
    var token = Expect(SyntaxKind.IdentifierToken);
    return new NameExpressionSyntax(token.Text, token);
}

private BooleanLiteralExpressionSyntax ParseBooleanLiteralExpression()
{
    if (Match(SyntaxKind.TrueKeyword, SyntaxKind.FalseKeyword))
    {
        return new BooleanLiteralExpressionSyntax(
            Previous.Kind == SyntaxKind.TrueKeyword ? true : false,
            Previous
        );
    }
    throw new ParserException(Previous, SyntaxKind.TrueKeyword, SyntaxKind.FalseKeyword);
}

private StringLiteralExpressionSyntax ParseStringLiteralExpression()
{
    var token = Expect(SyntaxKind.StringToken);
    return new StringLiteralExpressionSyntax(token.Text, token);
}

private ExpressionSyntax ParseParenthesizedExpression()
{
    Expect(SyntaxKind.OpenParenthesisToken);
    var expression = ParseExpression();
    Expect(SyntaxKind.CloseParenthesisToken);
    return expression;
}

private ExpressionSyntax ParsePrimaryExpression() =>
    Current.Kind switch
    {
        SyntaxKind.NumberToken => ParseNumericLiteralExpression(),
        SyntaxKind.IdentifierToken => ParseNameExpression(),
        SyntaxKind.StringToken => ParseStringLiteralExpression(),
        SyntaxKind.TrueKeyword => ParseBooleanLiteralExpression(),
        SyntaxKind.FalseKeyword => ParseBooleanLiteralExpression(),
        SyntaxKind.OpenParenthesisToken => ParseParenthesizedExpression(),
        _ => throw new ParserException(Current),
    };
```

Parsing parentheses requires `ParseExpression`, which we will implement later:

```csharp {title="Parse Expression Placeholder"}
private ExpressionSyntax ParseExpression()
{
    throw new NotImplementedException();
}
```

So far, the code follows the grammar closely. The literal-parsing methods call `Expect` or `Match`,
which advance `position` through `Consume`. We move through the token list as each grammar rule
recognizes its part of the expression; there is no `foreach` over all tokens. That may seem unusual
at first, but it becomes useful when we parse binary expressions.

### Parsing Unaries

Next, we parse unary expressions. The rule was:

```text {title="Unary Expression Grammar"}
unary ::= (MINUS | NOT) unary
        | primary
```

It is directly translatable into code. Recursive descent is nice.

```csharp {title="Parse Unary Expressions"}
private ExpressionSyntax ParseUnaryExpression()
{
    if (Match(SyntaxKind.MinusToken, SyntaxKind.BangToken))
    {
        var op = Previous;
        return new PrefixUnaryExpressionSyntax(op, ParseUnaryExpression());
    }

    return ParsePrimaryExpression();
}
```

### Parsing Binary Expressions

The remaining binary rules all have a similar shape:

```text {title="Repeated Binary Rule Pattern"}
rule ::= higher-precedence-rule ((operator-token | another-operator-token) higher-precedence-rule)*
```

We can translate that shape directly into code:

```csharp {title="Parse a Repeated Binary Rule"}
private ExpressionSyntax ParseRuleExpression()
{
    var left = ParseHigherPrecedenceRule();

    while (Match(SyntaxKind.OperatorToken, SyntaxKind.AnotherOperatorToken))
    {
        var op = Previous;
        var right = ParseHigherPrecedenceRule();
        left = new BinaryExpressionSyntax(left, op, right);
    }

    return left;
}
```

This is where the shared cursor becomes less obvious. A parsing method does not receive its own
slice of tokens. It receives no token argument at all. Instead, every method reads and updates the
same `position` field. A caller records neither how far a nested method will move nor how many calls
to `Consume` it will make. It asks the nested method to parse one complete subexpression and resumes
at whatever token is current when that method returns.

For example, consider `1 + 2 * price`. From inside `ParseAdditiveExpression`, parsing the right
operand looks like one call to `ParseMultiplicativeExpression`. That call moves `position` from 2 to
5 because it recursively parses `2`, matches `*`, and parses `price`. Deeper in the call chain,
however, the cursor still moves one token at a time:

<!-- prettier-ignore -->
![Nested parser calls for 1 plus 2 times price, showing ParseMultiplicativeExpression moving the shared position across the complete right-hand subexpression through three one-token Consume calls](/diagrams/expression-linq-binder/parser-recursive-cursor.svg)

We first parse the left side, which advances the position through its tokens. The current token may
then be an operator. If `Match` finds one, we save it and parse the right operand. If our rule ended
after one operator-and-operand pair:

```text {title="Repeated Binary Expression Grammar"}
rule ::= higher-precedence-rule (operator-token | another-operator-token) higher-precedence-rule
```

we would be done. In the repeated form, however, the token after the right operand may be another
operator. To build the left-associative AST shown above, we replace `left` with the new
`BinaryExpressionSyntax` and run the loop again. The expression parsed so far always becomes the
left operand of the next binary node.

If the loop finds no further operator, we return `left`. What is optional is another complete
operator-and-operand pair. If `Match` consumes an operator but the right operand is missing, the
call to `ParseHigherPrecedenceRule` fails with a `ParserException`.

Notice how the `*` in the rule becomes a `while` loop. I think the same concept would be much harder
with a `foreach` loop over the token list. Applying this pattern gives us:

```csharp {title="Parse Repeated Binary Expressions"}
private ExpressionSyntax ParseMultiplicativeExpression()
{
    var left = ParseUnaryExpression();

    while (Match(SyntaxKind.StarToken, SyntaxKind.SlashToken))
    {
        var op = Previous;
        var right = ParseUnaryExpression();
        left = new BinaryExpressionSyntax(left, op, right);
    }

    return left;
}

private ExpressionSyntax ParseAdditiveExpression()
{
    var left = ParseMultiplicativeExpression();

    while (Match(SyntaxKind.PlusToken, SyntaxKind.MinusToken))
    {
        var op = Previous;
        var right = ParseMultiplicativeExpression();
        left = new BinaryExpressionSyntax(left, op, right);
    }

    return left;
}

private ExpressionSyntax ParseLogicalAndExpression()
{
    var left = ParseEqualityExpression();

    while (Match(SyntaxKind.AmpersandAmpersandToken))
    {
        var op = Previous;
        var right = ParseEqualityExpression();
        left = new BinaryExpressionSyntax(left, op, right);
    }

    return left;
}

private ExpressionSyntax ParseLogicalOrExpression()
{
    var left = ParseLogicalAndExpression();

    while (Match(SyntaxKind.PipePipeToken))
    {
        var op = Previous;
        var right = ParseLogicalAndExpression();
        left = new BinaryExpressionSyntax(left, op, right);
    }

    return left;
}
```

Equality and comparison use `?` rather than `*`:

```text {title="Optional Binary Expression Grammar"}
equality       ::= comparison ((EQUAL | NOT-EQUAL) comparison)?
comparison     ::= addition ((LESS | LESS-EQUAL | GREATER | GREATER-EQUAL) addition)?
```

The `?` means that the operator-and-operand pair may occur once or not at all. In code, that becomes
an `if`:

```csharp {title="Parse Comparison and Equality Expressions"}
private ExpressionSyntax ParseRelationalExpression()
{
    var left = ParseAdditiveExpression();

    if (
        Match(
            SyntaxKind.LessThanToken,
            SyntaxKind.GreaterThanToken,
            SyntaxKind.LessThanOrEqualsToken,
            SyntaxKind.GreaterThanOrEqualsToken
        )
    )
    {
        var op = Previous;
        var right = ParseAdditiveExpression();
        left = new BinaryExpressionSyntax(left, op, right);
    }

    return left;
}

private ExpressionSyntax ParseEqualityExpression()
{
    var left = ParseRelationalExpression();

    if (Match(SyntaxKind.EqualEqualToken, SyntaxKind.BangEqualToken))
    {
        var op = Previous;
        var right = ParseRelationalExpression();
        left = new BinaryExpressionSyntax(left, op, right);
    }

    return left;
}
```

### Parsing Expressions

We have now implemented every rule except the top-level one:

```csharp {title="Complete ParseExpression" diff=true}
private ExpressionSyntax ParseExpression()
{
-   throw new NotImplementedException();
+   return ParseLogicalOrExpression();
}
```

Finally, we need a public entry point. After `ParseExpression` returns, a valid parse should be at
the `EndOfInputToken`. Calling `Expect` verifies that no unconsumed tokens remain:

```csharp {title="Parser Entry Point"}
public ExpressionSyntax Parse()
{
    var expr = ParseExpression();
    Expect(SyntaxKind.EndOfInputToken);
    return expr;
}
```

We can now give the lexer a query expression, pass its token list to the parser, and inspect the
resulting tree.

### Trying the Parser

Before printing a complete tree, a few focused examples help us check the boundaries of the grammar:

| Input             | Expected result                                                   |
| ----------------- | ----------------------------------------------------------------- |
| `1 + 2 * price`   | Accepted; `+` is the root and `*` is its right child              |
| `(1 + 2) * price` | Accepted; `*` is the root and `+` is its left child               |
| `a < b < c`       | Rejected at the second `<` because comparisons cannot be chained  |
| `price +`         | Rejected at the end of input because the right operand is missing |
| `(price + 1`      | Rejected at the end of input because the closing `)` is missing   |

The first two cases confirm precedence and parentheses. The other three confirm that `Parse` does
not silently accept a valid prefix while leaving malformed input behind.

### Simple AST Tree Printer

For a readable view of the AST, we can print it in the style of the Unix `tree` command:

```csharp {title="Print the Syntax Tree"}
sealed class SyntaxTreePrinter(ExpressionSyntax expression)
{
    public void Print()
    {
        Console.WriteLine(GetLabel(expression));
        PrintChildren(expression, string.Empty);
    }

    private static void PrintChildren(ExpressionSyntax node, string prefix)
    {
        switch (node)
        {
            case BinaryExpressionSyntax binary:
                PrintBranch(binary.Left, prefix, isLast: false);
                PrintBranch(binary.Right, prefix, isLast: true);
                break;

            case PrefixUnaryExpressionSyntax unary:
                PrintBranch(unary.Operand, prefix, isLast: true);
                break;
        }
    }

    private static void PrintBranch(ExpressionSyntax node, string prefix, bool isLast)
    {
        var connector = isLast ? "└── " : "├── ";
        Console.WriteLine($"{prefix}{connector}{GetLabel(node)}");

        var childPrefix = prefix + (isLast ? "    " : "│   ");
        PrintChildren(node, childPrefix);
    }

    private static string GetLabel(ExpressionSyntax node) =>
        node switch
        {
            NumericLiteralExpressionSyntax number => number.Value.ToString(),
            BooleanLiteralExpressionSyntax boolean => boolean.Value ? "true" : "false",
            StringLiteralExpressionSyntax text => $"\"{text.Value}\"",
            NameExpressionSyntax identifier => identifier.Identifier,
            BinaryExpressionSyntax binary => binary.OperatorToken.Text,
            PrefixUnaryExpressionSyntax unary => unary.OperatorToken.Text,

            _ => throw new InvalidOperationException($"Unsupported expression syntax: {node.GetType().Name}"),
        };
}
```

We can now run the complete lexer-parser-printer pipeline with the filter from earlier:

```csharp {title="Parse and Print a Filter"}
var source = "price + 10 * 2 > 100 && category == \"Books\" || !instock";

var tokens = new Lexer(source).Scan().ToList();
var expression = new Parser(tokens).Parse();

new SyntaxTreePrinter(expression).Print();
```

The printer makes the precedence encoded by the grammar visible:

```text {title="Printed Abstract Syntax Tree"}
||
├── &&
│   ├── >
│   │   ├── +
│   │   │   ├── price
│   │   │   └── *
│   │   │       ├── 10
│   │   │       └── 2
│   │   └── 100
│   └── ==
│       ├── category
│       └── "Books"
└── !
    └── instock
```

## What Comes Next

We have now completed the second stage of Linde's pipeline. The lexer turns source text into tokens,
and the parser arranges those tokens into an AST that preserves precedence, associativity, unary
operators, and explicit grouping. It also rejects malformed syntax before later stages need to
reason about it.

The parser deliberately knows nothing about `Product`, property types, or whether an expression
produces a Boolean value. That is the binder's job. In Part IV, we will resolve names such as
`price`, validate the operand types, and turn this syntax tree into a LINQ expression tree.
