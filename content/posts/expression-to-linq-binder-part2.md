+++
title = "From Filter Strings to LINQ (Part II)"
description = "Build a lexer, parser, and binder that turns user-defined filter strings into LINQ expression trees for dynamic queries."
date = "2026-09-04"
draft = true
tags = ["c#", "parser", "linq"]
math = true
+++

This post continues from part 1.

## Building the Lexer

The first step is to transform our source from a stream of characters into a stream of tokens. There
are something we need to take care of here:

1. Whitespace is not important and can be skipped
2. Reserved keywords are their own token
3. Strings start and end with quotes, identifiers don't

So let's start:

```csharp
internal sealed class Lexer(string Text)
{
    private int position = 0;
    private bool IsAtEnd => position >= Text.Length;
}
```

The position acts like a pointer to track the current position within the stream, where we start
evaluating if a new token is recognized. And `IsAtEnd` is kind of self explaining. We also need to
move further in the token stream:

```csharp
private void Advance() => position++;
```

And when we need to access the current character, we use:

```csharp
private char Current => Text[position];
```

These help us to get started to scan tokens. First we skip all whitespace:

```csharp
private void SkipWhitespace()
{
    while (char.IsWhiteSpace(Current))
    {
        Advance();
    }
}
```

And then retrieve the next token until we are at the end:

```csharp
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

The important method is now `NextToken()`. There is all the important logic of the lexer as it
creates the `SyntaxToken`. This is just a simple record:

```csharp
internal sealed record class SyntaxToken(
    SyntaxKind Kind, string Text, int Position
) {}
```

where `SyntaxKind` is an enum of all the possible kinds of tokens we can have:

```csharp
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

So let's write `NextToken`:

```csharp
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

Nice, but scanning for just simple one character tokens is not worth describing at all. But first
for completeness `ReadToken`. It already gives a hint of multiple charater token with its `length`
parameter.

```csharp
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

Now lets add the easier tokens like `&&` and `||` first:

```csharp {diff=true}
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

Looks like we also need to peek the `Next` character in the source stream. To also make this more
bound safe we replace and add:

```csharp {diff=true}
-private char Current => Text[position];

+private char Peek(int lookAhead) =>
+    position + lookAhead < Text.Length ? Text[position + lookAhead] : '\0';

+private char Current => Peek(0);
+private char Next => Peek(1);
```

To scan for tokens that offer multiple choices like `!=` vs. `==` or all the comparisons like `<`
vs. `<=`. We need a way to scan either a one character token or a two character token:

```csharp {diff=true}
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

Where `ReadCompoundToken` is a very obvious solution:

```csharp
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

Now only strings, numbers and identifiers are missing. Scanning for string as straightforward, we
see `"` then `Advance` until we see the next `"`:

```csharp
private SyntaxToken ReadString()
{
    var start = position;

    Advance(); // Skip the opening quote

    var startOfString = position;

    while (Current != '"')
    {
        if (IsAtEnd)
        {
            throw new LexerException($"Unterminated string literal at position {IsAtEnd}");
        }
        Advance();
    }

    var endOfString = position;

    Advance(); // Skip the closing quote

    return new SyntaxToken(SyntaxKind.StringToken, Text[startOfString..endOfString], start);
}
```

And we add it to the `NextToken` method and also for numbers and identifiers:

```csharp {diff=true}
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

Next is numbers, whenever we come across a number character, we start scanning for a number:

```csharp
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
written around how to do this right so that a user can understand the error message.{{< /note >}}We
`Advance` as long as we see a number, a dot, or a comma. This is of course not foolproof, as there
are no multiple dots in a number. But with `.` and `,` we can write nice things like `1,000,000.50`.
I really like the thousand separator, makes reading so much easier.

Last token kind is the identifier. I did a little hack here to make the lexer smaller as I did not
create token kinds for the reserved keywords. They are transformed into its corresponding operation.
But first, we scan for the identifier:

```csharp
private SyntaxToken ReadIdentifier()
{
    var start = position;

    while ((char.IsLetter(Current) || char.IsDigit(Current)))
    {
        Advance();
    }

    var identifier = Text[start..position];

    return new SyntaxToken(SyntaxKind.IdentifierToken, identifier, start);
}
```

Nothing special here, looks totally like all the other scan methods. We allow the identifiers to
have numbers within their scope but not their beginning. Afterwards we check if the scanned
identifier is a keyword of the language:

{{< note >}}I love C# switch expressions. IMHO they are one of the best features added to the
language.{{< /note >}}

```csharp
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

Of course, when we have keywords and members of the related query class having the same text, this
will not work and proper error handling shoud be done. For the scope of this block, it will then
just not work.

This was all code for the lexer. Actually it looks all the same and feels completely mechanical as
if this is could become part of something bigger or even be completely generated based on some
generic notation. But be warned, digging into this topic will lead into a lot of time spent reading
about NFA and DFA and that regex is just crazy. Checkout this awesome tutorial about
[Building a Regex engine](https://www.abstractsyntaxseed.com/blog/regex-engine/introduction).
