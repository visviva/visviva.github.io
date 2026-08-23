+++
title = "Circular Progress Bars in .NET MAUI"
description = "Learning how to create a custom and reusable UI controls with an embedded GraphicsView and child controls in .NET MAUI 10"
date = "2026-08-16"
draft = true
tags = ["c#", "xaml", "dotnet", "maui"]
math = true
+++

{{< note >}}I think in Flutter controls are called widgets, in React we call them components but
essentially they are all some kind of custom, user-defined UI elements.{{< /note >}} For a time
tracking app I am in need a special control I have not found yet. It shall be some kind of circular
progress bar having two rings and a custom area for child controls. The inner ring is to show the
planned time and the outer is used to show additional time that follows after the planned time. The
area in the middle will be used to place child controls. In my case it will be a
`VerticalStackLayout` containing label that show the times. I have further plans to reuse this
control, so my goal is to not hardcode everything but to create it as a custom control.

![Example design of the control](/diagrams/dotnet-maui-graphics-control/goal-control.drawio.svg)

Drawing it in draw.io is easy. We just need two circles and two arcs. For the child controls we just
need to calculate the area within the inner circle and clip the content if needed.

Now comes the hard part. I am new to .NET MAUI and I have no idea how to create a custom control
with custom graphics.

{{< note >}} To me this is the same as cooking vs. ordering a finished meal. I want to learn how to
cook and understand the ingredients not optimize the time to get the dish onto the table as quickly
as possible. Both cases are equally important, you need to know which path you are going to choose.
{{< /note >}}Of course, some AI-Agent, like Copilot, Claude and Codex is definitly capable of
creating this control for me. Propably within just a few minutes. But my goal is not to have the
control immediatly. I want to learn how stuff is working. I want to understand the ideas behind.

So the first place we start is just by looking at the
[documentation of .NET MAUI](https://learn.microsoft.com/en-us/dotnet/maui/?view=net-maui-10.0).
Lets start directly at the
[grpahics](https://learn.microsoft.com/en-us/dotnet/maui/user-interface/graphics/?view=net-maui-10.0).

There we have:

> There are many similarities between the functionality provided by Microsoft.Maui.Graphics, and the
> functionality provided by .NET MAUI shapes and brushes. However, each is aimed at different
> scenarios:

And then an explanation for `Maui.Graphics`:

> Microsoft.Maui.Graphics functionality must be consumed on a drawing canvas, enables performant
> graphics to be drawn, and provides a convenient approach for writing graphics-based controls. For
> example, a control that replicates the GitHub contribution profile can be more easily implemented
> using Microsoft.Maui.Graphics than by using .NET MAUI shapes.

and for `Maui.Shapes`:

> .NET MAUI shapes can be consumed directly on a page, and brushes can be consumed by all controls.
> This functionality is provided to help you produce an attractive UI.

I am not sure which one to use. The shapes sound easier so let's start looking into it.

## Shapes

Drawing a circle is actually trivial:

```xml
<Ellipse Stroke="Red"
         StrokeThickness="4"
         WidthRequest="150"
         HeightRequest="150"
         HorizontalOptions="Start" />
```

I guess drawing the elements and aranging them within a grid is doable. But drawing an arc looks not
so good:

```xml
<Path Stroke="Black">
    <Path.Data>
        <PathGeometry>
            <PathGeometry.Figures>
                <PathFigureCollection>
                    <PathFigure StartPoint="10,10">
                        <PathFigure.Segments>
                            <PathSegmentCollection>
                                <ArcSegment Size="100,50"
                                            RotationAngle="45"
                                            IsLargeArc="True"
                                            SweepDirection="CounterClockwise"
                                            Point="200,100" />
                            </PathSegmentCollection>
                        </PathFigure.Segments>
                    </PathFigure>
                </PathFigureCollection>
            </PathGeometry.Figures>
        </PathGeometry>
    </Path.Data>
</Path>
```

This is quite some indentation for a "just" and arc. I think it is definitly possible to do it with
shapes as the geometry is bindable. I guess, there can be a code behind that does the calculations
and updates the shapes. But this sounds like quite a lot of plumbing with the risk of landing in
unreadable XAML-hell.

So let's look at the graphics API.

## Graphics View

To draw something on a screen the
[documentation](https://learn.microsoft.com/en-us/dotnet/maui/user-interface/graphics/?view=net-maui-10.0)
tells to create a class that inherits from `IDrawable`. So let's start by creating a .NET MAUI app
in Visual Studio or an IDE of your choice and add a new class within the `Controls` namespace:

```csharp
namespace CircularProgressBar.Mobile.Controls;

public class CircularProgressBarDrawable : IDrawable
{
    public void Draw(ICanvas canvas, RectF dirtyRect)
    {
        // Drawing code goes here
    }
}
```

and in `MainPage.xaml` replace everything withing with:

{{< note >}} Unfortunately the background property of the graphics view does not work on windows. It
does work on Android. I had found some github issues that it was not working on Android quite some
time ago but was fixed. Maybe the fix did not work on Windows.{{< /note >}}

```xml
<?xml version="1.0" encoding="utf-8" ?>
<ContentPage
  xmlns="http://schemas.microsoft.com/dotnet/2021/maui"
  xmlns:x="http://schemas.microsoft.com/winfx/2009/xaml"
  x:Class="CircularProgressBar.Mobile.MainPage"
  xmlns:control="clr-namespace:CircularProgressBar.Mobile.Controls"
>
  <GraphicsView
    x:Name="GraphicsView"
    HeightRequest="400"
    WidthRequest="400"
    HorizontalOptions="Center"
    VerticalOptions="Center"
  >
    <GraphicsView.Drawable>
      <control:CircularProgressBarDrawable />
    </GraphicsView.Drawable>
  </GraphicsView>
</ContentPage>
```

We explicitly set the property `GraphicsView.Drawable` to `control:CircularProgressBarDrawable`.
This creates the connection between the control `GraphicsView` and our `CircularProgressBarDrawable`
class.

Then let's add some code to draw a few circles:

```csharp
public void Draw(ICanvas canvas, RectF dirtyRect)
{
    canvas.SaveState();

    canvas.FillColor = Colors.LightSlateGrey;
    canvas.FillRectangle(dirtyRect);

    canvas.RestoreState();

    double radius = 5.0;
    for (int i = 0; i < 200; i++)
    {
        canvas.DrawCircle(new Point(10.0, 10.0), radius);
        radius += 5.0;
    }

}

```

The method starts with saving the current drawing context onto a "drawing-context-property-stack".
This is useful as the drawing within this method is statful. `SaveState()` and `RestoreState()`
together behave like a scope and properties set within this scope only apply to this scope. In this
case this applies to the `FillColor` that is set to `Colors.LightSlateGrey`. Then a rectangle is
drawn over the whole area. The area is defined by `RectF dirtyRect`.

Then we just draw some circles with the center at $(10,10)$ and a radius of $5$ with an increment of
$5$ for every loop cycle.

Running the app reveals:

![Some circles on a graphics view](/diagrams/dotnet-maui-graphics-control/some-circles-1.png)

Nice, we have drawn circles! The hardest part of drawing something is done. To get the required
geometry of our custom control, we just need to do some simple maths.

Now to the next unknown. How can we make this a custom control? We have quite a bunch of circles,
how can we make the radius and its increment, the number of circles and their center, configurable?
Let's transform it to a custom control.

## Custom Control

To create the custom control, we just add a `.NET MAUI ContentView (XAML)` to the project. I gave it
the name `CircularProgressBarView.xaml`. It is also within the `Controls` namespace.

First thing we do it to move the `GraphicsView` from the `MainPage.xaml` into the newly created
`CircularProgressBarView.xaml`. But we do not set the property `<GraphicsView.Drawable>`. We do not
want the user to specify internals of the control. This would be a bad API.

```xml
<?xml version="1.0" encoding="utf-8" ?>
<ContentView
  xmlns="http://schemas.microsoft.com/dotnet/2021/maui"
  xmlns:x="http://schemas.microsoft.com/winfx/2009/xaml"
  x:Class="CircularProgressBar.Mobile.Controls.CircularProgressBarView"
  xmlns:control="clr-namespace:CircularProgressBar.Mobile.Controls"
>
  <Grid>
    <GraphicsView
      x:Name="GraphicsView"
      HeightRequest="400"
      WidthRequest="400"
      HorizontalOptions="Center"
      VerticalOptions="Center"
    />
  </Grid>
</ContentView>
```

And the magic now happens in the code behind file in `CircularProgressView.xaml.xs`. There we create
a bindable property for the number of circles. According to the
[documentation on how to create a custom control](https://learn.microsoft.com/en-us/dotnet/maui/user-interface/controls/contentview?view=net-maui-10.0)
this is easily done. We just need to declare it as properties:

```csharp
namespace CircularProgressBar.Mobile.Controls;

public partial class CircularProgressBarView : ContentView
{
    public static readonly BindableProperty NumberOfCirclesProperty = BindableProperty.Create(
        nameof(NumberOfCircles),
        typeof(int),
        typeof(CircularProgressBarView),
        100
    );

    public int NumberOfCircles
    {
        get => (int)GetValue(NumberOfCirclesProperty);
        set => SetValue(NumberOfCirclesProperty, value);
    }

    public CircularProgressBarView()
    {
        InitializeComponent();
    }
}
```

So far so good. This looks straightforward. No real magic. As we did not set the
`GraphicsView.Drawable` property, we now need to create the drawable manually and pass it the
`NumberOfCircles` value.

First we adapt `CircularProgressBarDrawable` and give it some properties with default values:

```csharp
public class CircularProgressBarDrawable : IDrawable
{
    public int NumberOfCircles { get; set; } = 100;
    public double InitialRadius { get; set; } = 5.0;
    public double RadiusIncrement { get; set; } = 5.0;

    public Point Center { get; set; } = new Point(10.0, 10.0);

    public void Draw(ICanvas canvas, RectF dirtyRect)
    {
        canvas.SaveState();

        canvas.FillColor = Colors.LightSlateGrey;
        canvas.FillRectangle(dirtyRect);

        canvas.RestoreState();

        double radius = InitialRadius;
        for (int i = 0; i < NumberOfCircles; i++)
        {
            canvas.DrawCircle(Center, radius);
            radius += RadiusIncrement;
        }
    }
}
```

Then in `CircularProgressView.xaml.xs` we add a member and adapt the constructor:

```csharp
public partial class CircularProgressBarView : ContentView
{
    ...

    private readonly CircularProgressBarDrawable _circularProgressBarDrawable = new();

    public CircularProgressBarView()
    {
        InitializeComponent();
        GraphicsView.Drawable = _circularProgressBarDrawable;
    }
}
```

To make our custom control interactive, let's add a slider on the main page and change the number of
circles. No view model, just some xaml magic happening.

A slider returns the values in floating point but our control accepts only integer. We just add the
awesome `CommunityToolkit.Maui` to have `DoubleToIntConverter` within xaml:

```bash
dotnet add package CommunityToolkit.Maui
```

and add `builder.UseMauiCommunityToolkit()` to `MauiProgram.cs`.

Then we can create add the slider and bind its value to our custom control within `MainPage.xaml`:

```xml
<?xml version="1.0" encoding="utf-8" ?>
<ContentPage
  xmlns="http://schemas.microsoft.com/dotnet/2021/maui"
  xmlns:x="http://schemas.microsoft.com/winfx/2009/xaml"
  x:Class="MauiApp1.MainPage"
  xmlns:control="clr-namespace:CircularProgressBar.Mobile.Controls"
  xmlns:toolkit="http://schemas.microsoft.com/dotnet/2022/maui/toolkit"
>
  <VerticalStackLayout>
    <control:CircularProgressBarView
      x:Name="CircularProgressBar"
      NumberOfCircles="{Binding Value, Source={x:Reference CircleSlider}, Converter={StaticResource DoubleToIntConverter}}"
    />

    <Grid ColumnDefinitions="150,*" ColumnSpacing="15" Margin="20">
      <Label
        Text="{Binding Value, Source={x:Reference CircleSlider}, StringFormat='Number of Circles: {0:F0}'}"
        HorizontalOptions="Center"
        VerticalOptions="Center"
        Grid.Column="0"
      />
      <Slider
        x:Name="CircleSlider"
        Minimum="0"
        Maximum="110"
        Value="20"
        Grid.Column="1"
        VerticalOptions="Center"
      />
    </Grid>
  </VerticalStackLayout>
</ContentPage>
```

Everthing build and runs so far bit it is not quite right.

![Changeable circles on a graphics view](/diagrams/dotnet-maui-graphics-control/some-circles-2.png)

When the slider is changed, the number of circles is not changing at all. Also at startup, $20$
circles are set but many more show up. What is the problem now?

When the slider is changed, the property is set and forwarded to the drawable. But the `Draw` method
is never called again. The property change must also tell the drawable to redraw.

There are propably many ways to do this but in my opinion the following is a straightforward way to
do it.

The `BindableProperty` offers a delegate that is called when the value is changed:

```csharp
public static readonly BindableProperty NumberOfCirclesProperty = BindableProperty.Create(
    nameof(NumberOfCircles),
    typeof(int),
    typeof(CircularProgressBarView),
    100,
    propertyChanged: OnPropertyOfDrawableChanged
);
```

In `OnPropertyOfDrawableChanged` we get the custom view object as parameter and tell it to update
the graphics view.

```csharp
private static void OnPropertyOfDrawableChanged(
    BindableObject bindable,
    object oldValue,
    object newValue
)
{
    // Pattern matching verifies the runtime type and avoids an invalid cast.
    if (bindable is CircularProgressBarView view)
    {
        view.UpdateDrawable();
    }
}
```

The `UpdateDrawable` method then does just set the `NumberOfCircles` propery in the drawable and
tell the graphics view to redraw:

```csharp
private void UpdateDrawable()
{
    _circularProgressBarDrawable.NumberOfCircles = NumberOfCircles;
    GraphicsView?.Invalidate();
}
```

Now it does work as we want to have it. To have controls for the other properties of drawable, this
is the way to go.

## Child Controls

### Child Controls the complicated way

### How do templates work

### Child Controls as template

## Quick math to create the final control

```

```
