+++
title = "From Filter Strings to LINQ (Part II)"
description = "Build the lexer for a small filter language and turn source text into tokens for the parser."
date = "2026-09-06"
draft = false
tags = ["c#", "parser", "linq", "dotnet"]
math = true
+++

This post continues from [Part I]({{< ref "expression-to-linq-binder-part1.md" >}}), where we
defined Linde's small query language and the pipeline that turns a filter string into a LINQ
predicate. In this part, we build the first stage of that pipeline: the lexer.

## Building the Lexer

The first step transforms the source text from a sequence of characters into a sequence of tokens.
There are three details we need to handle:

1. Whitespace between tokens is not significant and can be skipped.
2. Reserved words map to keyword or operator tokens.
3. Strings start and end with quotes; identifiers do not.

We start with the source text and a position:

```csharp {title="Lexer State"}
internal sealed class Lexer(string Text)
{
    private int position = 0;
    private bool IsAtEnd => position >= Text.Length;
}
```

The `position` field is the offset of the next character we want to inspect. `IsAtEnd` tells us when
that offset has reached or moved beyond the end of the source text. We also need a way to advance
through the text:

```csharp {title="Advance Through the Source"}
private void Advance() => position++;
```

To access the character at the current position, we add:

```csharp {title="Current Character"}
private char Current => Text[position];
```

This first version assumes that `position` is within the bounds of `Text`. We will make that access
safe shortly. With these helpers in place, we can skip whitespace:

```csharp {title="Skip Whitespace"}
private void SkipWhitespace()
{
    while (char.IsWhiteSpace(Current))
    {
        Advance();
    }
}
```

We then retrieve one token at a time until the lexer emits an end-of-input token:

```csharp {title="Scan the Token Sequence"}
public IEnumerable<SyntaxToken> Scan()
{
    SyntaxToken token;
    do
    {
        token = NextToken();
        yield return token;
    } while (token.Kind != SyntaxKind.EndOfInputToken);
}
```

`NextToken()` contains the dispatch logic and creates a `SyntaxToken`. For now, the token is a small
record:

```csharp {title="Token Definition"}
internal sealed record class SyntaxToken(
    SyntaxKind Kind, string Text, int Position
) {}
```

`SyntaxKind` lists every kind of token the language recognizes:

```csharp {title="Token Kinds"}
internal enum SyntaxKind
{
    BadToken,
    NumberToken,
    PlusToken,
    MinusToken,
    StarToken,
    SlashToken,
    EqualEqualToken,
    BangEqualToken,
    LessThanToken,
    GreaterThanToken,
    GreaterThanOrEqualsToken,
    LessThanOrEqualsToken,
    OpenParenthesisToken,
    CloseParenthesisToken,
    IdentifierToken,
    StringToken,
    BangToken,
    AmpersandAmpersandToken,
    PipePipeToken,
    TrueKeyword,
    FalseKeyword,
    EndOfInputToken,
}
```

Now we can write the first version of `NextToken`:

```csharp {title="Single-Character Token Dispatch"}
private SyntaxToken NextToken()
{
    SkipWhitespace();

    if (IsAtEnd)
    {
        return new SyntaxToken(SyntaxKind.EndOfInputToken, string.Empty, position);
    }

    return Current switch
    {
        '+' => ReadToken(SyntaxKind.PlusToken),
        '-' => ReadToken(SyntaxKind.MinusToken),
        '*' => ReadToken(SyntaxKind.StarToken),
        '/' => ReadToken(SyntaxKind.SlashToken),

        '(' => ReadToken(SyntaxKind.OpenParenthesisToken),
        ')' => ReadToken(SyntaxKind.CloseParenthesisToken),

        _ => ReadToken(SyntaxKind.BadToken),
    };
}
```

Single-character tokens are mechanical, but they establish the pattern we use for the rest of the
lexer. `ReadToken` records the starting position, advances by the requested length, and returns the
corresponding slice of source text. Its `length` parameter also prepares us for multi-character
tokens.

```csharp {title="Read a Token"}
private SyntaxToken ReadToken(SyntaxKind tokenType, int length = 1)
{
    var start = position;
    for (int i = 0; i < length; i++)
    {
        Advance();
    }
    return new SyntaxToken(tokenType, Text[start..position], start);
}
```

Let's add `&&` and `||` first:

```csharp {title="Add Logical Operators" diff=true}
private SyntaxToken NextToken()
{
    SkipWhitespace();

    if (IsAtEnd)
    {
        return new SyntaxToken(SyntaxKind.EndOfInputToken, string.Empty, position);
    }

    return Current switch
    {
        '+' => ReadToken(SyntaxKind.PlusToken),
        '-' => ReadToken(SyntaxKind.MinusToken),
        '*' => ReadToken(SyntaxKind.StarToken),
        '/' => ReadToken(SyntaxKind.SlashToken),

        '(' => ReadToken(SyntaxKind.OpenParenthesisToken),
        ')' => ReadToken(SyntaxKind.CloseParenthesisToken),

+       '&' when Next is '&' => ReadToken(SyntaxKind.AmpersandAmpersandToken, 2),
+       '|' when Next is '|' => ReadToken(SyntaxKind.PipePipeToken, 2),

        _ => ReadToken(SyntaxKind.BadToken),
    };
}
```

These tokens require us to inspect the next character without consuming it. `Peek` also makes access
to `Current` bounds-safe by returning the null character when the requested position lies beyond the
source text:

```csharp {title="Add Bounds-Safe Lookahead" diff=true}
-private char Current => Text[position];

+private char Peek(int lookAhead) =>
+    position + lookAhead < Text.Length ? Text[position + lookAhead] : '\0';

+private char Current => Peek(0);
+private char Next => Peek(1);
```

Some operators share their first character, such as `!` and `!=`, or `<` and `<=`. We need a helper
that chooses between a one-character token and a two-character token:

```csharp {title="Add Compound Operators" diff=true}
private SyntaxToken NextToken()
{
    SkipWhitespace();

    if (IsAtEnd)
    {
        return new SyntaxToken(SyntaxKind.EndOfInputToken, string.Empty, position);
    }

    return Current switch
    {
        '+' => ReadToken(SyntaxKind.PlusToken),
        '-' => ReadToken(SyntaxKind.MinusToken),
        '*' => ReadToken(SyntaxKind.StarToken),
        '/' => ReadToken(SyntaxKind.SlashToken),

        '(' => ReadToken(SyntaxKind.OpenParenthesisToken),
        ')' => ReadToken(SyntaxKind.CloseParenthesisToken),

        '&' when Next is '&' => ReadToken(SyntaxKind.AmpersandAmpersandToken, 2),
        '|' when Next is '|' => ReadToken(SyntaxKind.PipePipeToken, 2),

+       '=' => ReadCompoundToken('=', SyntaxKind.BadToken, SyntaxKind.EqualEqualToken),
+       '!' => ReadCompoundToken('=', SyntaxKind.BangToken, SyntaxKind.BangEqualToken),
+       '<' => ReadCompoundToken('=', SyntaxKind.LessThanToken, SyntaxKind.LessThanOrEqualsToken),
+       '>' => ReadCompoundToken('=', SyntaxKind.GreaterThanToken, SyntaxKind.GreaterThanOrEqualsToken),

        _ => ReadToken(SyntaxKind.BadToken),
    };
}
```

`ReadCompoundToken` checks the lookahead character and selects the appropriate token kind:

```csharp {title="Read a Compound Token"}
private SyntaxToken ReadCompoundToken(
    char secondCharacter,
    SyntaxKind singleType,
    SyntaxKind compoundType
)
{
    if (Next == secondCharacter)
    {
        return ReadToken(compoundType, 2);
    }
    return ReadToken(singleType, 1);
}
```

Only strings, numbers, and identifiers remain. A string starts with `"`. We skip that opening quote,
advance until we find the closing quote, and store only the text between them:

```csharp {title="Read a String Literal"}
private SyntaxToken ReadString()
{
    var start = position;

    Advance(); // Skip the opening quote

    var startOfString = position;

    while (Current != '"')
    {
        if (IsAtEnd)
        {
            throw new LexerException($"Unterminated string literal at position {position}");
        }
        Advance();
    }

    var endOfString = position;

    Advance(); // Skip the closing quote

    return new SyntaxToken(SyntaxKind.StringToken, Text[startOfString..endOfString], start);
}
```

We add strings to `NextToken`, together with the dispatch rules for numbers and identifiers:

```csharp {title="Add Strings, Numbers, and Identifiers" diff=true}
private SyntaxToken NextToken()
{
    SkipWhitespace();

    if (IsAtEnd)
    {
        return new SyntaxToken(SyntaxKind.EndOfInputToken, string.Empty, position);
    }

    return Current switch
    {
        '+' => ReadToken(SyntaxKind.PlusToken),
        '-' => ReadToken(SyntaxKind.MinusToken),
        '*' => ReadToken(SyntaxKind.StarToken),
        '/' => ReadToken(SyntaxKind.SlashToken),

        '(' => ReadToken(SyntaxKind.OpenParenthesisToken),
        ')' => ReadToken(SyntaxKind.CloseParenthesisToken),

        '&' when Next is '&' => ReadToken(SyntaxKind.AmpersandAmpersandToken, 2),
        '|' when Next is '|' => ReadToken(SyntaxKind.PipePipeToken, 2),

        '=' => ReadCompoundToken('=', SyntaxKind.BadToken, SyntaxKind.EqualEqualToken),
        '!' => ReadCompoundToken('=', SyntaxKind.BangToken, SyntaxKind.BangEqualToken),
        '<' => ReadCompoundToken('=', SyntaxKind.LessThanToken, SyntaxKind.LessThanOrEqualsToken),
        '>' => ReadCompoundToken('=', SyntaxKind.GreaterThanToken, SyntaxKind.GreaterThanOrEqualsToken),

+       '"' => ReadString(),

+       var c when char.IsDigit(c) => ReadNumber(),
+       var c when char.IsLetter(c) || c is '_' => TransformToReservedKeywordOrKeep(ReadIdentifier()),

        _ => ReadToken(SyntaxKind.BadToken),
    };
}
```

When we encounter a digit, `ReadNumber` consumes digits as well as `.` and `,` separators:

```csharp {title="Read a Number Literal"}
private SyntaxToken ReadNumber()
{
    var start = position;

    while (char.IsDigit(Current) || Current == '.' || Current == ',')
    {
        Advance();
    }

    return new SyntaxToken(SyntaxKind.NumberToken, Text[start..position], start);
}
```

{{< note >}}Error handling in lexer and parser is its own topic. I bet there could be whole books
written around how to do this right so that a user can understand the error message.{{< /note >}}The
lexer only groups these characters into a token; it does not validate their arrangement. For
example, it accepts `1.2.3` as one number token. The parser later rejects that text when it cannot
convert it to a `decimal`. The same approach also lets us write `1,000,000.50`. I like the thousands
separator because it makes large values easier to read.

The last kind of text we need to scan is an identifier. I keep the lexer small by mapping most
reserved words to the token kind of their corresponding operator. First, we read the identifier:

```csharp {title="Read an Identifier"}
private SyntaxToken ReadIdentifier()
{
    var start = position;

    while (char.IsLetter(Current) || char.IsDigit(Current) || Current == '_')
    {
        Advance();
    }

    var identifier = Text[start..position];

    return new SyntaxToken(SyntaxKind.IdentifierToken, identifier, start);
}
```

The dispatch rule in `NextToken` requires the first character to be a letter or underscore. Once
scanning has started, `ReadIdentifier` also accepts digits. Afterwards, we check whether the scanned
identifier is a reserved word:

{{< note >}}I love C# switch expressions. IMHO they are one of the best features added to the
language.{{< /note >}}

```csharp {title="Map Reserved Words"}
private static SyntaxToken TransformToReservedKeywordOrKeep(SyntaxToken token) =>
    token.Text.ToUpperInvariant() switch
    {
        "AND" => token with { Kind = SyntaxKind.AmpersandAmpersandToken },
        "OR" => token with { Kind = SyntaxKind.PipePipeToken },
        "NOT" => token with { Kind = SyntaxKind.BangToken },
        "TRUE" => token with { Kind = SyntaxKind.TrueKeyword },
        "FALSE" => token with { Kind = SyntaxKind.FalseKeyword },
        "IS" => token with { Kind = SyntaxKind.EqualEqualToken },
        _ => token,
    };
```

This keyword transformation has a tradeoff: we cannot refer to properties named `And`, `Or`, `Not`,
`True`, `False`, or `Is`. Supporting those names would require escaped identifiers or different
keyword rules. For the scope of this post, we accept that limitation.

That completes the lexer. Much of the code follows the same mechanical pattern, which hints that it
could be generated from a more general notation. But be warned: digging into that topic can lead to
many hours spent reading about nondeterministic finite automata (NFAs), deterministic finite
automata (DFAs), and how deep regular expressions go. The tutorial
[Building a Regex Engine](https://www.abstractsyntaxseed.com/blog/regex-engine/introduction) is an
excellent place to continue down that rabbit hole.

For now, `Scan` gives us a sequence of tokens and their source positions. The lexer does not decide
operator precedence or whether an expression is meaningful. That work belongs to the parser, which
is the next stage of the pipeline.
