# End to end tests with Terraform

Each implementation will have its own subdirectory consisting of:

1. terraform files to stand up a lambda function and any adjoining infrastructure
2. a `lambda` directory consisting of the code to be zipped for deploy

For example sake below, we'll use the `url` implementation (for function url invocations).

> Note: I'm currently using [Terraform CLI](https://developer.hashicorp.com/terraform/cli) and [Cloud](https://app.terraform.io/app), but may at some point look into [OpenTofu](https://opentofu.org/) as a fully free and open source replacement.

## Preparing for deployment

Change to the implementation's lambda directory and run the build script to install dependencies and prepare for the generated zip:

```bash
test/terraform$ cd url/lambda
test/terraform/url/lambda$ npm run build
```

## Standing it up

Next, change back to the impl directory and run terraform to plan and apply changes:

```bash
test/terraform/url/lambda$ cd ..
test/terraform/url$ terraform validate
test/terraform/url$ terraform plan
test/terraform/url$ terraform apply
```

## Taking it for a test drive

Once infrastructure has been deployed, find the output indicating and endpoint url, and test it:

```bash
test/terraform/url$ LAMBDA_URL=$(terraform output -raw endpoint_url)
test/terraform/url$ curl -vvvv -X POST -d '{"body":"data"}' -H "X-Custom-Headers: stuff" "$LAMBDA_URL/some/path?and=query&string=values"
```

## Cleaning up

Remember to destroy infrastructure once done with testing;

```bash
test/terraform/url$ terraform destroy
```
