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
tells to create a class that implements `IDrawable`. So let's start by creating a .NET MAUI app in
Visual Studio or an IDE of your choice and add a new class within the `Controls` namespace:

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
  x:Class="CircularProgressBar.Mobile.MainPage"
  xmlns:control="clr-namespace:CircularProgressBar.Mobile.Controls"
  xmlns:toolkit="http://schemas.microsoft.com/dotnet/2022/maui/toolkit"
>
  <ContentPage.Resources>
    <toolkit:DoubleToIntConverter x:Key="DoubleToIntConverter" />
  </ContentPage.Resources>

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

When the slider is moved, the binding updates `CircularProgressBarView.NumberOfCircles`, but the
drawable still contains its default value of $100$. In addition, changing the drawable does not
automatically redraw the GraphicsView.

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

I have found two ways to implement the child controls. I am not sure which way is the idiomatic way
as the documentation does not give a concrete example for our use case. So both ways are presented
here.

{{< note >}} The MAUI Community Toolkit also has a source generator `BindableProperty`. This reduces
duplication of defining these bindable properties. Definitly worth looking into. {{< /note >}} One
way is to use an attribute `ContentProperty`. There is a little bit of not really helpful
documentation
[here](https://learn.microsoft.com/en-us/dotnet/maui/user-interface/controls/contentview?view=net-maui-10.0).
This is mainly based on a
[stackoverflow question](https://stackoverflow.com/questions/75017130/add-custom-content-inside-a-contentview-using-xaml).
This way is used a lot by the [MAUI Community Toolkit](https://github.com/CommunityToolkit/Maui).

{{< note >}} IMHO the documentation for templates is written for people that already understand
templates. At first I could not really get the core idea. I have written a small introduction to
templates make the concept easier to understand for myself. If you already know templates, you can
skip it.{{< /note >}} The other way is using control templates. There is quite a lot of
documentation
[here](https://learn.microsoft.com/en-us/dotnet/maui/fundamentals/controltemplate?view=net-maui-10.0).
The idea is to split the visual structure of the control and the content of the control. The visual
structure is defined in the template with a placeholder for child content. In contrast to the
`ContentProperty` approach this ways is more explicit and needs more glue to work.

I personally completed the control using control templates. This way has documentation compared to
the `ContentProperty` approach.

### Option A: Using ContentProperty

Let's start by adding a child to our control in `MainPage.xaml`:

```xml
<control:CircularProgressBarView
  x:Name="CircularProgressBar"
  NumberOfCircles="{Binding Value, Source={x:Reference CircleSlider}, Converter={StaticResource DoubleToIntConverter}}"
>
  <Label
    Text="Hello World!"
    HorizontalTextAlignment="Center"
    VerticalTextAlignment="Center"
    FontSize="24"
  />
</control:CircularProgressBarView>
```

When we then run our application, the graphics view is completely overridden by the label.

![Overriden graphics view](/diagrams/dotnet-maui-graphics-control/some-circles-3.png)

The documentation of `ContentProperty` actually explains this behavior. The `Content` property of
the custom control is set to the label which then overrides the graphics view completely. To avoid
this override, we redirect the content into another property using `ContentProperty`. We therefore
adapt `CircularProgressBarView` within `CircularProgressBarView.xaml.cs` and change it to:

```csharp
[ContentProperty(nameof(CenterContent))]
public partial class CircularProgressBarView : ContentView
{
    public static readonly BindableProperty CenterContentProperty = BindableProperty.Create(
        nameof(CenterContent),
        typeof(View),
        typeof(CircularProgressBarView)
    );

    public View? CenterContent
    {
        get => (View?)GetValue(CenterContentProperty);
        set => SetValue(CenterContentProperty, value);
    }

    // rest of class unchanged
}
```

When we now run the application, it is displaying nothing of our custom control anymore. As we
redirected the content into the property, no content is set anymore. We must adapt the
`CircularProgressView.xaml`. We explicitly wrap the content with `<ContentView.Content>`.

```xml
<ContentView.Content>
  <Grid>
    <GraphicsView
      x:Name="GraphicsView"
      HeightRequest="400"
      WidthRequest="400"
      HorizontalOptions="Center"
      VerticalOptions="Center"
    />
  </Grid>
</ContentView.Content>
```

Now the graphics view is back when the application is run.

To display the child content we add a `ContentView` and bind it to our `CenterContent` property. To
enable bindings to itself, we set `x:Name` to `this` to enable access to the instance of the custom
control. To excplicitly control the visiblity for what is on top of what, we also accordingly set
the Z-index.

```xml
<?xml version="1.0" encoding="utf-8" ?>
<ContentView
  xmlns="http://schemas.microsoft.com/dotnet/2021/maui"
  xmlns:x="http://schemas.microsoft.com/winfx/2009/xaml"
  x:Class="CircularProgressBar.Mobile.Controls.CircularProgressBarView"
  xmlns:control="clr-namespace:CircularProgressBar.Mobile.Controls"
  x:Name="this"
>
  <ContentView.Content>
    <Grid>
      <GraphicsView
        x:Name="GraphicsView"
        HeightRequest="400"
        WidthRequest="400"
        HorizontalOptions="Center"
        VerticalOptions="Center"
        ZIndex="0"
      />

      <ContentView
        Content="{Binding CenterContent, Source={x:Reference this}}"
        HorizontalOptions="Fill"
        VerticalOptions="Fill"
        ZIndex="1"
      />
    </Grid>
  </ContentView.Content>
</ContentView>
```

And it is working!

![Custom control with child control](/diagrams/dotnet-maui-graphics-control/some-circles-4.png)

### Option B: Using templates

Before we change our custom control to a templated view, we first must understand how control
templates work in .NET MAUI. If you already know control templates, feel free to skip the next
section.

#### How do templates work

For me, the easiest mental model of how templates work is:

> A `ControlTemplate` is a replaceable XAML body for a `ContentView` or `ContentPage`. It defines
> the visual structure seprately from the logic of the control/page.

The control owns the data and the behavior while the template decides on what the control looks
like. The
[documentation](https://learn.microsoft.com/en-us/dotnet/maui/fundamentals/controltemplate?view=net-maui-10.0)
directly jumps into `RelativeSource`, `TemplatedParent`, `Resources`, etc. without describing this
simple idea.

Lets forget custom controls for a moment. We just have a normal page:

```xml
<ContentPage
    xmlns="http://schemas.microsoft.com/dotnet/2021/maui"
    xmlns:x="http://schemas.microsoft.com/winfx/2009/xaml"
    x:Class="MyApp.MainPage">

</ContentPage>
```

and we give this page a control template:

```xml
<ContentPage
    xmlns="http://schemas.microsoft.com/dotnet/2021/maui"
    xmlns:x="http://schemas.microsoft.com/winfx/2009/xaml"
    x:Class="MyApp.MainPage">

    <ContentPage.ControlTemplate>
        <ControlTemplate>
            <Border
                BackgroundColor="LightBlue"
                Padding="30">

                <Label
                    Text="I came from the template"
                    FontSize="24" />

            </Border>
        </ControlTemplate>
    </ContentPage.ControlTemplate>

</ContentPage>
```

Then the visual structure of the page comes from the template. We can think of this:

```xml
<ContentPage>
    ...
</ContentPage>
```

as an object that has a property like:

```csharp
page.ControlTemplate = someTemplate;
```

When the template is applied, MAUI will then create the controls described in the template and put
them into the visual tree of the page.

```text
ContentPage
    └── ControlTemplate
            └── Border
                    └── Label
```

This is the core concept.

In most of the times, it makes sense to put the template into a resources or into a separate
resources file, to enable its reuse. In a lot of cases it does not make sense to directly put it
into the page itself.

This leads to:

```xml
<ContentPage
    xmlns="http://schemas.microsoft.com/dotnet/2021/maui"
    xmlns:x="http://schemas.microsoft.com/winfx/2009/xaml"
    x:Class="MyApp.MainPage"
    ControlTemplate="{StaticResource BlueTemplate}">

    <ContentPage.Resources>
        <ControlTemplate x:Key="BlueTemplate">
            <Border
                BackgroundColor="LightBlue"
                Padding="30">

                <Label
                    Text="Hello from the template"
                    FontSize="24" />

            </Border>
        </ControlTemplate>
    </ContentPage.Resources>
</ContentPage>
```

Where the template is referenced by its key `BlueTemplate` in the setter
`ControlTemplate="{StaticResource BlueTemplate}"`. The mental model is now:

```text
ResourceDictionary
    └── "BlueTemplate"
          └── Border
                └── Label


ContentPage
    └── ControlTemplate = BlueTemplate
```

No magic so far.

Now to the interesting part of child controls. Let's suppose we have a page now with content and a
set template:

```xml
<ContentPage
    ...
    ControlTemplate="{StaticResource BlueTemplate}">

    <VerticalStackLayout>
        <Label Text="Username" />
        <Entry />
        <Button Text="Login" />
    </VerticalStackLayout>

</ContentPage>
```

We now have a problem. Where should the content appear? We need a mechanism to say:

> Put the content of the page here.

This is what `ContentPresenter` does. It is the location within the template where the content of
the page is inserted.

So we update the template to

```xml
<ControlTemplate x:Key="BlueTemplate">
    <Border
        BackgroundColor="LightBlue"
        Padding="30">

        <ContentPresenter />

    </Border>
</ControlTemplate>
```

Conceptually the the model becomes:

```text
ResourceDictionary
    └── "BlueTemplate"
          └── Border
                └── ContentPresenter


ContentPage
    ├── ControlTemplate = BlueTemplate
    └── Content
          └── VerticalStackLayout
                ├── Label
                ├── Entry
                └── Button

```

Which on instantiation of the page leads to replacement of `ContentPresenter` and a instantiated
control tree of

```text
Border
└── VerticalStackLayout
    ├── Label
    ├── Entry
    └── Button
```

{{< note >}} No real magic behind. I wish the offical documentation would sometimes be more tutorial
than reference, especially in the fundamentals section. Sometimes simple examples are much more
useful than fancy examples using multiple things at once.{{< /note >}} This is the most important
concept of this feature as the same model can also be applied to a custom control.

#### Migrating the custom control to control templates

To convert our custom control now to templates, we start with adapting `CircularProgressView.xaml`:

```xml
<?xml version="1.0" encoding="utf-8" ?>
<ContentView
  xmlns="http://schemas.microsoft.com/dotnet/2021/maui"
  xmlns:x="http://schemas.microsoft.com/winfx/2009/xaml"
  x:Class="CircularProgressBar.Mobile.Controls.CircularProgressBarView"
>
  <ContentView.Resources>
    <ControlTemplate x:Key="CircularProgressBarTemplate">
      <Grid>
        <GraphicsView
          x:Name="GraphicsView"
          HeightRequest="400"
          WidthRequest="400"
          HorizontalOptions="Center"
          VerticalOptions="Center"
          ZIndex="0"
        />

        <ContentPresenter />
      </Grid>
    </ControlTemplate>
  </ContentView.Resources>
</ContentView>
```

The code behind in `CircularProgressView.xaml.cs` is changed to:

```csharp
namespace CircularProgressBar.Mobile.Controls;

public partial class CircularProgressBarView : ContentView
{
    public static readonly BindableProperty NumberOfCirclesProperty = BindableProperty.Create(...);
    public int NumberOfCircles{ ... }
    private readonly CircularProgressBarDrawable _circularProgressBarDrawable = new();

    public CircularProgressBarView()
    {
        InitializeComponent();
    }

    protected override void OnApplyTemplate()
    {
        base.OnApplyTemplate();

        var graphicsView = GetTemplateChild("GraphicsView") as GraphicsView;
        graphicsView?.Drawable = _circularProgressBarDrawable;
        UpdateDrawable();
    }

    private void UpdateDrawable()
    {
        _circularProgressBarDrawable.NumberOfCircles = NumberOfCircles;

        var graphicsView = GetTemplateChild("GraphicsView") as GraphicsView;
        graphicsView?.Invalidate();
    }

    private static void OnPropertyOfDrawableChanged(
        BindableObject bindable,
        object oldValue,
        object newValue
    ) {...}

}
```

The only real difference is that the we now need the method `OnApplyTemplate` to wire the drawable
into the graphics view. We cannot directly address the graphics view anymore, as it is now part of
the template. Therefore we have to use `GetTemplateChild("GraphicsView")` to address it. The same
applies also to `UpdateDrawable`.

To make it working, we have to set the template for our custom view in `MainPage.xaml`:

```xml
<control:CircularProgressBarView
  x:Name="CircularProgressBar"
  NumberOfCircles="{Binding Value, Source={x:Reference CircleSlider}, Converter={StaticResource DoubleToIntConverter}}"

  ControlTemplate="{StaticResource CircularProgressBarTemplate}"

>
  <Label
    Text="Hello World!"
    HorizontalTextAlignment="Center"
    VerticalTextAlignment="Center"
    FontSize="24"
  />
</control:CircularProgressBarView>
```

And its working!

![Custom control with child control](/diagrams/dotnet-maui-graphics-control/some-circles-4.png)

But the API of our custom control is not great. In our case, the user of the control should not set
the control template for the control. This should not be part of the API of this control. So lets
revert the change in `MainPage.xaml` and find a way to automatically set the `ControlTemplate`.

The easiest way I have found to accomplish this, is to just explicitly set the `ControlTemplate` in
the code behind in `CircularProgressView.xaml.cs`. On instantiation we need to set the
`ControlTemplate` property. We do this in the constructor:

```csharp
public CircularProgressBarView()
{
    InitializeComponent();
    var theControlTemplate = Resources["CircularProgressBarTemplate"];
    ControlTemplate = theControlTemplate as ControlTemplate;
}
```

Running the application again shows that it is working and the API stays clean.

## Finalizing the control

Now we know how to create a custom control with child controls. We know how to draw circles and we
also know how to pipe all of the part with each other. Let's complete the control and add the
circles and the arcs.

We first start with the most interesting part, the drawable. The public API of the drawable is a
record for the immutable properties of the rings:

```csharp
public readonly record struct RingProperties(
    float RingThickness,
    float RingSpacing,
    float StartAngle,
    float DisabledOpacity,
    Color TrackColor,
    Color ProgressColor
);
```

The other dynamic properties of the Drawable are modeled as properties of the drawable:

```csharp
public float InnerProgress { get; set; }
public float OuterProgress { get; set; }
public bool IsEnabled { get; set; } = true;
```

We also need two utility methods to keep the angle within $360$ degrees or set it to $90$ degress by
default and to clamp the progress within $0$ and $1$:

```csharp
private static float NormalizeAngle(float angle) => (float.IsFinite(angle)) ? angle % 360 : 90;
private static float ClampProgress(float progress) =>
    (float.IsFinite(progress)) ? Math.Clamp(progress, 0.0f, 1.0f) : 0.0f;
```

In the draw method:

```csharp
public void Draw(ICanvas canvas, RectF dirtyRect)
{
    var diameter = Math.Min(dirtyRect.Width, dirtyRect.Height);

    var ringGeometry = RingsGeometry.Create(
        diameter,
        _ringProperties.RingThickness,
        _ringProperties.RingSpacing
    );

    ...
```

We first calculate the diameter and then calculate the properties for all rings. To calculate this,
we use `RingGeometry` and its `Create` method:

```csharp
private readonly record struct RingsGeometry(
    float Thickness,
    float OuterRadius,
    float InnerRadius,
    float ContentDiameter
)
{
    public static RingsGeometry Create(float diameter, float requestedThickness, float requestedSpacing)
    {
        float availableRadius = diameter / 2;
        float thickness = Math.Min(SanitizeLength(requestedThickness), availableRadius / 2);
        float remainingRadius = Math.Max(0, availableRadius - (2 * thickness));
        float spacing = Math.Min(SanitizeLength(requestedSpacing), remainingRadius);
        float outerRadius = Math.Max(0, availableRadius - (thickness / 2));
        float innerRadius = Math.Max(0, outerRadius - thickness - spacing);
        float contentDiameter = Math.Max(
            0,
            (float)((diameter - (4 * thickness) - (2 * spacing)) / Math.Sqrt(2.0))
        );
        return new RingsGeometry(thickness, outerRadius, innerRadius, contentDiameter);
    }
    private static float SanitizeLength(float value)
    {
        return (float.IsFinite(value) && value > 0) ? value : 0;
    }
}
```

Based on the available space, we calculate if the requested thickness is possible, the outer ring
radius, the inner ring radius and the space for the child content. Essentially, `contentDiameter`
calculates the lenght of a square that fits within a circle.

We now have the ring geometry and we can now tell the parent class of the drawable the available
content space. We can do this by adding a delegate to the drawable class which is called when the
result is available.

```csharp
class CircularProgressBarDrawable : IDrawable
{
    public event Action<float>? ContentDiameterChanged;

    public float ContentDiameter { get; private set; } = 0.0f;

    private void SetContentDiameter(float contentDiameter)
    {
        if (ContentDiameter.Equals(contentDiameter))
        {
            return;
        }

        ContentDiameter = contentDiameter;
        ContentDiameterChanged?.Invoke(contentDiameter);
    }

    ...
}
```

In the `Draw` method we then call it:

```csharp
public void Draw(ICanvas canvas, RectF dirtyRect)
{
    var diameter = Math.Min(dirtyRect.Width, dirtyRect.Height);

    var ringGeometry = RingsGeometry.Create(
        diameter,
        _ringProperties.RingThickness,
        _ringProperties.RingSpacing
    );

    if (ringGeometry.Thickness <= 0 || ringGeometry.ContentDiameter <= 0)
    {
        SetContentDiameter(0.0f);
        return;
    }

    SetContentDiameter(ringGeometry.ContentDiameter);

    ...
```

With all these parameters available we can finalize the `Draw` method to find the center of the
canvas and draw the rings and the arcs there:

```csharp
public void Draw(ICanvas canvas, RectF dirtyRect)
{
    var diameter = Math.Min(dirtyRect.Width, dirtyRect.Height);

    var ringGeometry = RingsGeometry.Create(
        diameter,
        _ringProperties.RingThickness,
        _ringProperties.RingSpacing
    );

    if (ringGeometry.Thickness <= 0 || ringGeometry.ContentDiameter <= 0)
    {
        SetContentDiameter(0.0f);
        return;
    }

    SetContentDiameter(ringGeometry.ContentDiameter);

    var center = new PointF(
        dirtyRect.Left + (dirtyRect.Width / 2),
        dirtyRect.Top + (dirtyRect.Height / 2)
    );
    float startAngle = NormalizeAngle(_ringProperties.StartAngle);

    canvas.SaveState();

    canvas.Alpha = IsEnabled ? 1.0f : _ringProperties.DisabledOpacity;
    canvas.StrokeSize = ringGeometry.Thickness;

    DrawRing(canvas, center, ringGeometry.InnerRadius, _ringProperties.TrackColor);
    DrawProgressArc(
        canvas,
        center,
        ringGeometry.InnerRadius,
        _ringProperties.ProgressColor,
        InnerProgress,
        startAngle
    );

    DrawRing(canvas, center, ringGeometry.OuterRadius, _ringProperties.TrackColor);
    DrawProgressArc(
        canvas,
        center,
        ringGeometry.OuterRadius,
        _ringProperties.ProgressColor,
        OuterProgress,
        startAngle
    );

    canvas.RestoreState();
}
```

Based on the `IsEnabled` property we set the alpha value of the canvas and then just draw the rings
and the arcs.

The `DrawRing` method is quite simple, not more than we currently do:

```csharp
private static void DrawRing(ICanvas canvas, PointF center, float radius, Color trackColor)
{
    canvas.SaveState();
    canvas.StrokeLineCap = LineCap.Butt;
    canvas.StrokeColor = trackColor;
    canvas.DrawCircle(center, radius);
    canvas.RestoreState();
}
```

and the `DrawProgressArc` is a little bit more code but not really much more complicated:

```csharp
private static void DrawProgressArc(
    ICanvas canvas,
    PointF center,
    float radius,
    Color progressColor,
    float progress,
    float startAngle
)
{
    canvas.SaveState();

    canvas.StrokeLineCap = LineCap.Round;
    canvas.StrokeColor = progressColor;

    var clampedProgress = ClampProgress(progress);

    switch (clampedProgress)
    {
        case <= 0:
            break;
        case >= 1.0f:
            canvas.DrawCircle(center, radius);
            break;
        default:
        {
            float endAngle = startAngle - (clampedProgress * 360.0f);
            float left = (center.X - radius);
            float top = (center.Y - radius);
            float diameter = (radius * 2.0f);
            canvas.DrawArc(left, top, diameter, diameter, startAngle, endAngle, true, false);
            break;
        }
    }

    canvas.RestoreState();
}
```

Essentially we just check if the progress is $0$, then we are done and draw nothing, if it is larger
or equal to $1$, then we just draw a circle over the existing circle or in the other cases, we draw
an arc from the start angle to the end angle. In `DrawArc` the first boolean `true` means that we
draw clockwise and the second boolean `false` tells that the arc is not a closed area.

In `CircularProgressBar.xaml.cs` we declare all the bindable properties and their backing
properties. We then need some methods to wire up the piping:

```csharp
public partial class CircularProgressBar : ContentView
{
    // ... all bindable properties and backing properties ...

    private CircularProgressBarDrawable? _drawable;
    private GraphicsView? _graphicsView;

    public CircularProgressBar()
    {
        PropertyChanged += OnViewPropertyChanged;

        InitializeComponent();
        ControlTemplate = Resources["CircularProgressBarTemplate"] as ControlTemplate;
    }

    protected override void OnApplyTemplate()
    {
        base.OnApplyTemplate();

        _graphicsView = GetTemplateChild("GraphicsView") as GraphicsView;
        ReplaceDrawable();
    }

    ...
}
```

Like before, we set the template and initialize the drawable with the relevant properties and the
delegate:

```csharp
private void ReplaceDrawable()
{
    if (_graphicsView is null)
    {
        return;
    }

    if (_drawable is not null)
    {
        _drawable.ContentDiameterChanged -= OnContentDiameterChanged;
    }

    _drawable = new CircularProgressBarDrawable(
        new RingProperties(
            RingThickness,
            RingSpacing,
            StartAngle,
            DisabledOpacity,
            TrackColor,
            ProgressColor
        )
    );

    _drawable.ContentDiameterChanged += OnContentDiameterChanged;
    _graphicsView.Drawable = _drawable;
    UpdateDrawable();
}
```

The callback `OnContentDiameterChanged` tells the UI thread to be aware of changes in the available
size for the child content.

The `UpdateDrawable` is nearly unchanged:

```csharp
private void UpdateDrawable()
{
    if (_drawable is null)
    {
        return;
    }
    _drawable.InnerProgress = InnerProgress;
    _drawable.OuterProgress = OuterProgress;
    _drawable.IsEnabled = IsEnabled;
    _graphicsView?.Invalidate();
}
```

To make use of the general `IsEnabled` property, the constructor has registered a callback for
changed properties:

```csharp
PropertyChanged += OnViewPropertyChanged;
```

There we just check if the `IsEnabled` property is changed:

```csharp
private void OnViewPropertyChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
{
    if (e.PropertyName == nameof(IsEnabled))
    {
        UpdateDrawable();
    }
}
```

In the XAML of the control are no changes. It's a `GraphicsView` and a `ContentPresenter` in a
template.

With some other controls to set the properties, it's working and looks like:

![complete](https://private-user-images.githubusercontent.com/72554879/637699137-71714c0e-e9a5-4d7f-b64d-11f01dc34f9e.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3ODc1MDQ4MTMsIm5iZiI6MTc4NzUwNDUxMywicGF0aCI6Ii83MjU1NDg3OS82Mzc2OTkxMzctNzE3MTRjMGUtZTlhNS00ZDdmLWI2NGQtMTFmMDFkYzM0ZjllLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNjA4MjMlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjYwODIzVDE3MDE1M1omWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTVmMjEwMGVhNWE4YTUxMmU5ZWZkYTM0YTIzZTk3NGY2NDA2NjAxMDQ1NmEyZWQ1YjljMjEwNWIwZGRhMThiYjYmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0JnJlc3BvbnNlLWNvbnRlbnQtdHlwZT1pbWFnZSUyRnBuZyJ9.i_hIg8NKKyLftEI0RApX54owPkRJQFYhF8N1pqscsWk)

I have published the custom control on [github](https://github.com/visviva/CircularProgressBar.Maui)
and [nuget](https://www.nuget.org/packages/CircularProgressBar.Maui). Feel free to take a look at
the code.
